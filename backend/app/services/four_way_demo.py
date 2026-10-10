import os
import asyncio
import uuid
import time
import concurrent.futures
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from app.db.database import SessionLocal
from app.models.domain import DemoSession as DBDemoSession, DemoMeasurement, DemoDecision

try:
    import cv2
except ImportError:
    cv2 = None

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

import numpy as np

# Thread pool for blocking video I/O and YOLO inference
_inference_pool = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="cv_worker")

# Max frame width for inference (resize large frames for CPU performance)
MAX_INFERENCE_WIDTH = 640


class CentroidTracker:
    def __init__(self, max_disappeared=15, max_distance=50):
        self.next_object_id = 0
        self.objects = {}
        self.disappeared = {}
        self.classes = {}
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    def register(self, centroid, cls):
        self.objects[self.next_object_id] = centroid
        self.classes[self.next_object_id] = cls
        self.disappeared[self.next_object_id] = 0
        self.next_object_id += 1
        return self.next_object_id - 1

    def deregister(self, object_id):
        if object_id in self.objects: del self.objects[object_id]
        if object_id in self.disappeared: del self.disappeared[object_id]
        if object_id in self.classes: del self.classes[object_id]

    def update(self, rects, classes):
        if len(rects) == 0:
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
            return self.objects.copy(), self.classes.copy()

        input_centroids = np.zeros((len(rects), 2), dtype="int")
        for i, (x1, y1, x2, y2) in enumerate(rects):
            input_centroids[i] = (int((x1+x2)/2), int((y1+y2)/2))

        if len(self.objects) == 0:
            for i in range(len(input_centroids)):
                self.register(input_centroids[i], classes[i])
        else:
            object_ids = list(self.objects.keys())
            object_centroids = list(self.objects.values())

            D = np.linalg.norm(np.array(object_centroids)[:, np.newaxis] - input_centroids, axis=2)

            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]

            used_rows = set()
            used_cols = set()

            for row, col in zip(rows, cols):
                if row in used_rows or col in used_cols: continue
                if D[row, col] > self.max_distance: continue

                object_id = object_ids[row]
                self.objects[object_id] = input_centroids[col]
                self.classes[object_id] = classes[col]
                self.disappeared[object_id] = 0

                used_rows.add(row)
                used_cols.add(col)

            unused_rows = set(range(D.shape[0])).difference(used_rows)
            unused_cols = set(range(D.shape[1])).difference(used_cols)

            for row in unused_rows:
                object_id = object_ids[row]
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)

            for col in unused_cols:
                self.register(input_centroids[col], classes[col])

        return self.objects.copy(), self.classes.copy()


def _build_roi_contour(roi_normalized: List[List[float]], frame_h: int, frame_w: int) -> Optional[np.ndarray]:
    """Convert normalized ROI coordinates to pixel contour suitable for cv2.pointPolygonTest.
    
    Returns None if the ROI is invalid (fewer than 3 points, non-finite coords, etc.).
    """
    if len(roi_normalized) < 3:
        return None
    
    points = []
    for p in roi_normalized:
        if len(p) < 2:
            return None
        x_norm, y_norm = float(p[0]), float(p[1])
        if not (np.isfinite(x_norm) and np.isfinite(y_norm)):
            return None
        px = int(x_norm * frame_w)
        py = int(y_norm * frame_h)
        points.append([px, py])
    
    contour = np.array(points, dtype=np.int32).reshape((-1, 1, 2))
    return contour


def _safe_point_in_roi(contour: Optional[np.ndarray], cx: float, cy: float) -> bool:
    """Test if a point is inside the ROI contour, safely handling type conversion.
    
    cv2.pointPolygonTest requires the point as a tuple of plain Python float/int,
    NOT numpy scalars. This function ensures correct conversion.
    """
    if contour is None:
        return False
    # Convert to plain Python floats — this is the fix for the cv2.pointPolygonTest crash
    pt = (float(cx), float(cy))
    try:
        return cv2.pointPolygonTest(contour, pt, False) >= 0
    except cv2.error:
        return False


class CVJob:
    def __init__(self, direction: str, video_path: str):
        self.direction = direction
        self.video_path = video_path
        self.status = "starting"
        self.metrics = {
            "queue_length": 0,
            "raw_detections_per_frame": 0,
            "total_detected": 0,
            "currently_tracked": 0,
            "cars": 0,
            "motorcycles": 0,
            "buses": 0,
            "trucks": 0,
            "waiting_time": None,
            "last_updated": None,
            "frames_processed": 0,
        }
        # Use maxsize=2 so we always have the freshest frame, dropping old ones
        self.frame_queue = asyncio.Queue(maxsize=2)
        self.error = None
        self.cap = None
        
        self.tracker = CentroidTracker()
        self.unique_tracks = set()
        self.track_class_counts = {2: 0, 3: 0, 5: 0, 7: 0}
        
        # Configurable Uncalibrated Default ROI (bottom 40% of the screen)
        self.roi_polygon_normalized = [
            [0.0, 0.6],
            [1.0, 0.6],
            [1.0, 1.0],
            [0.0, 1.0]
        ]
        
        # Rate-limited logging
        self._last_log_time = 0
        self._log_interval = 5.0  # seconds between diagnostic logs


class DemoSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.status = "initializing"
        self.jobs: Dict[str, CVJob] = {}
        self.is_paused = False
        self.is_stopped = False
        self.signal_state = {
            "north": "RED",
            "south": "RED",
            "east": "RED",
            "west": "RED"
        }
        self.logs = []
        self.active_phase = None # "NS" or "EW"
        self.phase_end_time = time.time()
        self.in_clearance = False
        self.phase_waiting_time = {"NS": 0, "EW": 0}
        self.pending_recommendation = None
        self._tasks: List[asyncio.Task] = []
        
    def add_log(self, n, s, e, w, phase, reason, duration):
        self.logs.insert(0, {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "north_queue": n,
            "south_queue": s,
            "east_queue": e,
            "west_queue": w,
            "selected_phase": phase,
            "reason": reason,
            "duration": duration
        })
        if len(self.logs) > 50:
            self.logs.pop()


class FourWayDemoService:
    def __init__(self):
        self.model = None
        self.sessions: Dict[str, DemoSession] = {}
        self.video_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/videos"))
        os.makedirs(self.video_dir, exist_ok=True)
        self._load_model()
        self.directions = ["north", "south", "east", "west"]

    def _load_model(self):
        if self.model is None and YOLO is not None:
            print("Loading YOLO model for Four-Way Demo...")
            try:
                self.model = YOLO("yolov8n.pt")
                print("YOLO model loaded.")
            except Exception as e:
                print(f"Failed to load YOLO model: {e}")

    def check_videos(self):
        status = {}
        for d in self.directions:
            path = os.path.join(self.video_dir, f"{d}.mp4")
            status[d] = os.path.exists(path)
        return status

    async def start_demo(self) -> str:
        if YOLO is None:
            raise RuntimeError("YOLO library not installed. Please wait for installation.")
        
        self._load_model()
        
        # Check all videos
        missing = []
        for d in self.directions:
            path = os.path.join(self.video_dir, f"{d}.mp4")
            if not os.path.exists(path):
                missing.append(f"{d}.mp4")
                
        if missing:
            raise FileNotFoundError(f"Missing required video files in app/data/videos/: {', '.join(missing)}")
            
        session_id = str(uuid.uuid4())
        session = DemoSession(session_id)
        
        # Persist session start
        try:
            db = SessionLocal()
            db_session = DBDemoSession(id=session_id, status="running")
            db.add(db_session)
            db.commit()
            db.close()
        except Exception as e:
            print(f"Failed to persist session creation: {e}")
            raise RuntimeError(f"Database persistence failed: {e}")
        
        for d in self.directions:
            path = os.path.join(self.video_dir, f"{d}.mp4")
            session.jobs[d] = CVJob(d, path)
            
        self.sessions[session_id] = session
        
        # Start workers — each in its own task
        for d in self.directions:
            task = asyncio.create_task(self._process_video(session, d))
            session._tasks.append(task)
            
        # Start signal optimization loop
        task = asyncio.create_task(self._signal_optimizer_loop(session))
        session._tasks.append(task)
        
        session.status = "running"
        return session_id

    def _do_inference_sync(self, frame: np.ndarray, direction: str) -> Tuple[np.ndarray, list, list]:
        """Run YOLO inference synchronously — intended to be called via run_in_executor.
        
        Resizes large frames before inference for CPU performance.
        Returns (annotated_frame_at_original_size, boxes_list, clss_list).
        """
        target_classes = [2, 3, 5, 7]  # Cars, motos, buses, trucks
        h, w = frame.shape[:2]
        
        # Resize for inference if the frame is wider than MAX_INFERENCE_WIDTH
        scale = 1.0
        inference_frame = frame
        if w > MAX_INFERENCE_WIDTH:
            scale = MAX_INFERENCE_WIDTH / w
            new_w = MAX_INFERENCE_WIDTH
            new_h = int(h * scale)
            inference_frame = cv2.resize(frame, (new_w, new_h))
        
        results = self.model(inference_frame, classes=target_classes, verbose=False)
        
        boxes_list = []
        clss_list = []
        annotated_frame = frame.copy()
        
        if results and len(results) > 0:
            res = results[0]
            if res.boxes and len(res.boxes) > 0:
                # Get boxes and scale back to original frame coords
                raw_boxes = res.boxes.xyxy.cpu().tolist()
                clss_list = res.boxes.cls.int().cpu().tolist()
                
                if scale != 1.0:
                    boxes_list = [[b[0]/scale, b[1]/scale, b[2]/scale, b[3]/scale] for b in raw_boxes]
                else:
                    boxes_list = raw_boxes
                
                # Draw detections on original frame
                for i, (x1, y1, x2, y2) in enumerate(boxes_list):
                    x1i, y1i, x2i, y2i = int(x1), int(y1), int(x2), int(y2)
                    cls_id = clss_list[i] if i < len(clss_list) else 0
                    cls_names = {2: "Car", 3: "Moto", 5: "Bus", 7: "Truck"}
                    label = cls_names.get(cls_id, f"cls{cls_id}")
                    cv2.rectangle(annotated_frame, (x1i, y1i), (x2i, y2i), (0, 255, 0), 2)
                    cv2.putText(annotated_frame, label, (x1i, y1i - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        
        return annotated_frame, boxes_list, clss_list

    async def _process_video(self, session: DemoSession, direction: str):
        job = session.jobs[direction]
        job.status = "processing"
        loop = asyncio.get_event_loop()
        
        try:
            # Open video capture in thread to avoid blocking event loop
            cap = await loop.run_in_executor(_inference_pool, cv2.VideoCapture, job.video_path)
            job.cap = cap
            
            if not cap.isOpened():
                raise ValueError(f"Could not open {direction} video file: {job.video_path}")
            
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            # Process at approximately 2-5 fps for CPU machines
            frame_skip = max(1, int(fps / 3))
            frame_count = 0
            
            print(f"[{direction}] Video opened: {job.video_path}, FPS={fps:.1f}, skip={frame_skip}")
            
            while not session.is_stopped:
                if session.is_paused:
                    await asyncio.sleep(0.5)
                    continue
                
                # Read frame in thread pool to avoid blocking the event loop
                ret, frame = await loop.run_in_executor(_inference_pool, cap.read)
                
                if not ret:
                    # Loop video for continuous demo
                    await loop.run_in_executor(_inference_pool, cap.set, cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = await loop.run_in_executor(_inference_pool, cap.read)
                    if not ret:
                        job.error = f"Cannot read frames from {direction} video"
                        break
                
                frame_count += 1
                
                # Skip frames for performance (process every Nth frame)
                if frame_count % frame_skip != 0:
                    continue
                
                # Run YOLO inference in thread pool
                annotated_frame, boxes_list, clss_list = await loop.run_in_executor(
                    _inference_pool, self._do_inference_sync, frame, direction
                )
                
                # Tracker update (fast, OK on event loop)
                objects, object_classes = job.tracker.update(boxes_list, clss_list)
                
                # ROI membership check with proper type conversion
                h, w = frame.shape[:2]
                roi_contour = _build_roi_contour(job.roi_polygon_normalized, h, w)
                
                current_in_roi = 0
                for obj_id, centroid in objects.items():
                    # centroid is a numpy array — extract as Python float for pointPolygonTest
                    cx, cy = float(centroid[0]), float(centroid[1])
                    
                    in_roi = _safe_point_in_roi(roi_contour, cx, cy)
                    if in_roi:
                        current_in_roi += 1
                        if obj_id not in job.unique_tracks:
                            job.unique_tracks.add(obj_id)
                            cls = object_classes.get(obj_id, 2)
                            job.track_class_counts[cls] = job.track_class_counts.get(cls, 0) + 1
                    
                    # Draw track ID on annotated frame
                    cv2.putText(annotated_frame, f"ID:{obj_id}",
                                (int(cx) - 10, int(cy) - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                # Draw ROI overlay
                if roi_contour is not None:
                    cv2.polylines(annotated_frame, [roi_contour], isClosed=True, color=(0, 255, 255), thickness=2)
                    cv2.putText(annotated_frame, "Uncalibrated Default ROI",
                                (10, int(h * 0.6) - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
                
                # Update metrics
                now_iso = datetime.utcnow().isoformat() + "Z"
                job.metrics["queue_length"] = current_in_roi
                job.metrics["raw_detections_per_frame"] = len(boxes_list)
                job.metrics["currently_tracked"] = len(objects)
                job.metrics["total_detected"] = len(job.unique_tracks)
                job.metrics["cars"] = job.track_class_counts.get(2, 0)
                job.metrics["motorcycles"] = job.track_class_counts.get(3, 0)
                job.metrics["buses"] = job.track_class_counts.get(5, 0)
                job.metrics["trucks"] = job.track_class_counts.get(7, 0)
                job.metrics["last_updated"] = now_iso
                job.metrics["frames_processed"] = job.metrics.get("frames_processed", 0) + 1
                
                # Resize annotated frame for streaming (limit to 640px wide for bandwidth)
                stream_frame = annotated_frame
                if w > 640:
                    stream_scale = 640 / w
                    stream_frame = cv2.resize(annotated_frame, (640, int(h * stream_scale)))
                
                # Encode frame
                _, buffer = cv2.imencode('.jpg', stream_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                frame_bytes = buffer.tobytes()
                
                # Drop old frames, keep only newest
                while not job.frame_queue.empty():
                    try:
                        job.frame_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        break
                await job.frame_queue.put(frame_bytes)
                
                # Rate-limited diagnostic logging
                now = time.time()
                if now - job._last_log_time >= job._log_interval:
                    job._last_log_time = now
                    print(f"[{direction}] frame={job.metrics['frames_processed']}, "
                          f"detections={len(boxes_list)}, queue={current_in_roi}, "
                          f"tracked={len(objects)}, unique={len(job.unique_tracks)}")
                
                # Yield to event loop
                await asyncio.sleep(0.01)
                
            # Cleanup
            if cap.isOpened():
                cap.release()
            job.cap = None
            job.status = "completed"
            print(f"[{direction}] Processing completed. Total frames processed: {job.metrics.get('frames_processed', 0)}")
            
        except Exception as e:
            job.status = "error"
            job.error = str(e)
            print(f"[{direction}] CV Processing error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # Signal end of stream
            try:
                job.frame_queue.put_nowait(None)
            except asyncio.QueueFull:
                pass

    async def _signal_optimizer_loop(self, session: DemoSession):
        # Initial wait for CV to process a few frames
        await asyncio.sleep(5)
        
        while not session.is_stopped:
            if session.is_paused:
                await asyncio.sleep(1)
                continue
                
            current_time = time.time()
            if current_time >= session.phase_end_time:
                # Need to decide next phase or process clearance
                
                if session.pending_recommendation:
                    # Waiting for operator action
                    await asyncio.sleep(0.5)
                    continue

                if session.in_clearance:
                    # Finish clearance, turn all to RED, then pick new phase
                    session.in_clearance = False
                    session.signal_state = {k: "RED" for k in self.directions}
                    await asyncio.sleep(2) # All-Red interval
                    
                    # Decide new phase
                    n_q = session.jobs["north"].metrics["queue_length"]
                    s_q = session.jobs["south"].metrics["queue_length"]
                    e_q = session.jobs["east"].metrics["queue_length"]
                    w_q = session.jobs["west"].metrics["queue_length"]
                    
                    ns_demand = n_q + s_q
                    ew_demand = e_q + w_q

                    ns_score = ns_demand + (session.phase_waiting_time["NS"] * 0.2)
                    ew_score = ew_demand + (session.phase_waiting_time["EW"] * 0.2)
                    
                    if ns_score == 0 and ew_score == 0:
                        next_phase = "NS" if session.active_phase != "NS" else "EW"
                        reason = "No demand, alternating baseline"
                    elif ns_score >= ew_score:
                        next_phase = "NS"
                        reason = f"Higher NS effective score ({ns_score:.1f} vs {ew_score:.1f}) [Demand: {ns_demand}, Wait: {session.phase_waiting_time['NS']}s]"
                    else:
                        next_phase = "EW"
                        reason = f"Higher EW effective score ({ew_score:.1f} vs {ns_score:.1f}) [Demand: {ew_demand}, Wait: {session.phase_waiting_time['EW']}s]"
                        
                    # Calculate duration based on demand
                    max_q = max(ns_demand if next_phase == "NS" else ew_demand, 1)
                    duration = min(max(max_q * 3, 10), 45) # 3s per car, min 10s, max 45s
                    
                    session.pending_recommendation = {
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "recommended_phase": "North-South" if next_phase == "NS" else "East-West",
                        "duration": duration,
                        "reason": reason,
                        "ns_demand": ns_demand,
                        "ew_demand": ew_demand
                    }
                
                else:
                    # Current green phase ending, enter Yellow clearance
                    session.in_clearance = True
                    
                    # Accumulate wait time for the other phase
                    if session.active_phase == "NS":
                        session.phase_waiting_time["EW"] += 20
                        session.phase_waiting_time["NS"] = 0
                    elif session.active_phase == "EW":
                        session.phase_waiting_time["NS"] += 20
                        session.phase_waiting_time["EW"] = 0

                    if session.active_phase == "NS":
                        session.signal_state["north"] = "YELLOW"
                        session.signal_state["south"] = "YELLOW"
                    elif session.active_phase == "EW":
                        session.signal_state["east"] = "YELLOW"
                        session.signal_state["west"] = "YELLOW"
                    
                    session.phase_end_time = time.time() + 4 # 4 seconds yellow
            
            await asyncio.sleep(0.5)

    def apply_phase(self, session: DemoSession, phase_name: str, duration: int, reason: str):
        next_phase = "NS" if phase_name == "North-South" else "EW"
        session.active_phase = next_phase
        
        session.signal_state = {k: "RED" for k in self.directions}
        if next_phase == "NS":
            session.signal_state["north"] = "GREEN"
            session.signal_state["south"] = "GREEN"
        else:
            session.signal_state["east"] = "GREEN"
            session.signal_state["west"] = "GREEN"
            
        n_q = session.jobs["north"].metrics["queue_length"]
        s_q = session.jobs["south"].metrics["queue_length"]
        e_q = session.jobs["east"].metrics["queue_length"]
        w_q = session.jobs["west"].metrics["queue_length"]
        
        session.add_log(n_q, s_q, e_q, w_q, phase_name, reason, duration)
        session.phase_end_time = time.time() + duration
        
        try:
            db = SessionLocal()
            db_measurement = DemoMeasurement(
                session_id=session.session_id,
                north_queue=n_q,
                south_queue=s_q,
                east_queue=e_q,
                west_queue=w_q
            )
            db_decision = DemoDecision(
                session_id=session.session_id,
                selected_phase=phase_name,
                reason=reason,
                duration=duration,
                north_queue_input=n_q,
                south_queue_input=s_q,
                east_queue_input=e_q,
                west_queue_input=w_q
            )
            db.add(db_measurement)
            db.add(db_decision)
            db.commit()
            db.close()
        except Exception as e:
            print(f"Failed to persist decision: {e}")

    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        session = self.sessions.get(session_id)
        if not session:
            return {"status": "not_found"}
            
        approaches = {}
        for d in self.directions:
            job = session.jobs.get(d)
            if job:
                approaches[d] = {
                    "queue_length_estimate": job.metrics.get("queue_length", 0),
                    "raw_detections": job.metrics.get("raw_detections_per_frame", 0),
                    "currently_tracked": job.metrics.get("currently_tracked", 0),
                    "cumulative_track_ids": job.metrics.get("total_detected", 0),
                    "total_unique_tracked": job.metrics.get("total_detected", 0),
                    "cars": job.metrics.get("cars", 0),
                    "trucks": job.metrics.get("trucks", 0),
                    "waiting_time": "Unsupported (No tracking ID persistence across lines)",
                    "status": job.status,
                    "error": job.error,
                    "last_updated": job.metrics.get("last_updated"),
                    "frames_processed": job.metrics.get("frames_processed", 0),
                }
            else:
                approaches[d] = {
                    "status": "unavailable",
                    "error": "Feed missing or failed"
                }

        # Resolve human-readable active phase
        active_phase_name = "North-South" if session.active_phase == "NS" else ("East-West" if session.active_phase == "EW" else None)

        # Transition state
        if session.pending_recommendation:
            transition_state = "WAITING FOR APPROVAL"
        elif session.in_clearance:
            if any(v == "YELLOW" for v in session.signal_state.values()):
                transition_state = "YELLOW"
            else:
                transition_state = "ALL-RED"
        elif any(v == "GREEN" for v in session.signal_state.values()):
            transition_state = "GREEN"
        elif all(v == "RED" for v in session.signal_state.values()):
            transition_state = "ALL-RED"
        else:
            transition_state = "GREEN" if session.status == "running" else "ALL-RED"

        remaining_seconds = None
        if (
            session.phase_end_time 
            and session.status in ("running", "initializing")
            and not session.is_paused 
            and not session.pending_recommendation
        ):
            remaining_seconds = max(0, int(session.phase_end_time - time.time()))
                
        return {
            "status": session.status,
            "is_paused": session.is_paused,
            "is_stopped": session.is_stopped,
            "active_phase": active_phase_name,
            "transition_state": transition_state,
            "in_clearance": session.in_clearance,
            "remaining_seconds": remaining_seconds,
            "approaches": approaches,
            "signal": session.signal_state,
            "logs": session.logs,
            "pending_recommendation": session.pending_recommendation,
            "server_time": datetime.utcnow().isoformat() + "Z"
        }
        
    def perform_action(self, session_id: str, action: str):
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("Session not found")
            
        if action == "pause":
            session.is_paused = True
        elif action == "resume":
            session.is_paused = False
        elif action == "stop":
            session.is_stopped = True
            session.status = "completed"
            
            # Release video captures
            for d, job in session.jobs.items():
                if job.cap is not None and job.cap.isOpened():
                    job.cap.release()
                    job.cap = None
                job.status = "completed"
            
            # Cancel async tasks
            for task in session._tasks:
                if not task.done():
                    task.cancel()
            session._tasks.clear()
            
            # Persist completion
            try:
                db = SessionLocal()
                db_session = db.query(DBDemoSession).filter(DBDemoSession.id == session_id).first()
                if db_session:
                    db_session.status = "completed"
                    db_session.end_time = datetime.utcnow()
                    db.commit()
                db.close()
            except Exception as e:
                print(f"Failed to persist session stop: {e}")
        elif action == "approve_recommendation":
            if session.pending_recommendation:
                rec = session.pending_recommendation
                self.apply_phase(session, rec["recommended_phase"], rec["duration"], rec["reason"])
                session.pending_recommendation = None
        elif action == "reject_recommendation":
            if session.pending_recommendation:
                rec = session.pending_recommendation
                alt_phase = "East-West" if rec["recommended_phase"] == "North-South" else "North-South"
                self.apply_phase(session, alt_phase, 15, "Operator manually rejected AI recommendation")
                session.pending_recommendation = None

four_way_demo = FourWayDemoService()
