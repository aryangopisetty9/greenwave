import os
try:
    import cv2
except ImportError:
    cv2 = None
import asyncio
import uuid
import time
from typing import Dict, Any, Optional

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

class CVJob:
    def __init__(self, job_id: str, video_path: str):
        self.job_id = job_id
        self.video_path = video_path
        self.status = "starting"
        self.metrics = {
            "total_detected": 0,
            "cars": 0,
            "motorcycles": 0,
            "buses": 0,
            "trucks": 0,
            "unique_tracked": 0,
            "progress_percent": 0.0
        }
        self.tracked_ids = set()
        self.is_paused = False
        self.is_stopped = False
        self.frame_queue = asyncio.Queue(maxsize=30)
        self.error = None

class CVService:
    def __init__(self):
        self.model = None
        self.jobs: Dict[str, CVJob] = {}
        self.scenarios = {
            "traffic_1": {"id": "traffic_1", "name": "Traffic 1", "description": "Traffic video scenario 1", "file": "traffic_1.mp4"},
            "traffic_2": {"id": "traffic_2", "name": "Traffic 2", "description": "Traffic video scenario 2", "file": "traffic_2.mp4"},
            "traffic_3": {"id": "traffic_3", "name": "Traffic 3", "description": "Traffic video scenario 3", "file": "traffic_3.mp4"},
        }
        self.video_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/videos"))
        os.makedirs(self.video_dir, exist_ok=True)
        self._load_model()

    def _load_model(self):
        if self.model is None and YOLO is not None:
            # Initialize lightweight model
            print("Loading YOLO model...")
            try:
                self.model = YOLO("yolov8n.pt")
                print("YOLO model loaded.")
            except Exception as e:
                print(f"Failed to load YOLO model: {e}")

    def get_scenarios(self):
        for k, v in self.scenarios.items():
            path = os.path.join(self.video_dir, v["file"])
            v["exists"] = os.path.exists(path)
        return list(self.scenarios.values())

    async def start_analysis(self, scenario_id: str) -> str:
        if YOLO is None:
            raise RuntimeError("YOLO library not installed. Please wait for installation.")
        
        self._load_model()
        if scenario_id not in self.scenarios:
            raise ValueError("Invalid scenario ID")
        
        scenario = self.scenarios[scenario_id]
        video_path = os.path.join(self.video_dir, scenario["file"])
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file {scenario['file']} not found in app/data/videos/. Please place the MP4 file there.")
        
        job_id = str(uuid.uuid4())
        job = CVJob(job_id, video_path)
        self.jobs[job_id] = job
        
        # Start background task
        asyncio.create_task(self._process_video(job))
        return job_id

    async def _process_video(self, job: CVJob):
        job.status = "processing"
        try:
            cap = cv2.VideoCapture(job.video_path)
            if not cap.isOpened():
                raise ValueError("Could not open video file.")
            
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            frame_idx = 0
            
            # YOLO classes: 2=car, 3=motorcycle, 5=bus, 7=truck (COCO dataset)
            target_classes = [2, 3, 5, 7]
            
            while cap.isOpened() and not job.is_stopped:
                if job.is_paused:
                    await asyncio.sleep(0.5)
                    continue
                    
                ret, frame = cap.read()
                if not ret:
                    break
                    
                frame_idx += 1
                job.metrics["progress_percent"] = round((frame_idx / total_frames) * 100, 2) if total_frames > 0 else 0
                
                # YOLO tracking
                results = self.model.track(frame, classes=target_classes, persist=True, verbose=False)
                
                cars, motos, buses, trucks = 0, 0, 0, 0
                if results and len(results) > 0:
                    res = results[0]
                    # Draw boxes
                    annotated_frame = res.plot()
                    
                    if res.boxes and res.boxes.id is not None:
                        boxes = res.boxes.xyxy.cpu()
                        track_ids = res.boxes.id.int().cpu().tolist()
                        clss = res.boxes.cls.int().cpu().tolist()
                        
                        for box, track_id, cls in zip(boxes, track_ids, clss):
                            job.tracked_ids.add(track_id)
                            if cls == 2: cars += 1
                            elif cls == 3: motos += 1
                            elif cls == 5: buses += 1
                            elif cls == 7: trucks += 1
                else:
                    annotated_frame = frame
                
                job.metrics["cars"] = cars
                job.metrics["motorcycles"] = motos
                job.metrics["buses"] = buses
                job.metrics["trucks"] = trucks
                job.metrics["total_detected"] = cars + motos + buses + trucks
                job.metrics["unique_tracked"] = len(job.tracked_ids)
                
                # Encode frame to JPEG
                _, buffer = cv2.imencode('.jpg', annotated_frame)
                frame_bytes = buffer.tobytes()
                
                # Put in queue, drop if full (meaning no one is consuming or consuming too slow)
                if job.frame_queue.full():
                    try:
                        job.frame_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                await job.frame_queue.put(frame_bytes)
                
                # Small sleep to yield loop
                await asyncio.sleep(0.01)
                
            cap.release()
            job.status = "completed"
        except Exception as e:
            job.status = "error"
            job.error = str(e)
            print(f"CV Processing error: {e}")
        finally:
            # Put a None sentinel to signal end of stream
            if not job.frame_queue.full():
                await job.frame_queue.put(None)

    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        job = self.jobs.get(job_id)
        if not job:
            return {"status": "not_found"}
        return {
            "status": job.status,
            "metrics": job.metrics,
            "error": job.error,
            "is_paused": job.is_paused,
            "is_stopped": job.is_stopped
        }
        
    def pause_job(self, job_id: str):
        if job_id in self.jobs:
            self.jobs[job_id].is_paused = True

    def resume_job(self, job_id: str):
        if job_id in self.jobs:
            self.jobs[job_id].is_paused = False

    def stop_job(self, job_id: str):
        if job_id in self.jobs:
            self.jobs[job_id].is_stopped = True

cv_service = CVService()
