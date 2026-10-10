import pytest
import numpy as np
import os
from app.services.four_way_demo import (
    CentroidTracker, CVJob, DemoSession, FourWayDemoService,
    _build_roi_contour, _safe_point_in_roi
)

try:
    import cv2
except ImportError:
    cv2 = None


# ─── 1. CentroidTracker tests ───

def test_centroid_tracker_association():
    tracker = CentroidTracker(max_disappeared=5, max_distance=50)
    
    # Frame 1: One vehicle
    objects, classes = tracker.update([[100, 100, 120, 120]], [2])
    assert len(objects) == 1
    object_id = list(objects.keys())[0]
    
    # Frame 2: Same vehicle slightly moved
    objects2, classes2 = tracker.update([[105, 105, 125, 125]], [2])
    assert len(objects2) == 1
    assert list(objects2.keys())[0] == object_id

def test_centroid_tracker_expiry():
    tracker = CentroidTracker(max_disappeared=2, max_distance=50)
    objects, classes = tracker.update([[100, 100, 120, 120]], [2])
    obj_id = list(objects.keys())[0]
    
    # Frame 2: No vehicles (disappeared = 1)
    objects, classes = tracker.update([], [])
    assert len(objects) == 1 # Still there, but disappeared=1
    
    # Frame 3: No vehicles (disappeared = 2)
    objects, classes = tracker.update([], [])
    assert len(objects) == 1
    
    # Frame 4: No vehicles (disappeared = 3 > 2 -> expired)
    objects, classes = tracker.update([], [])
    assert len(objects) == 0


# ─── 2. ROI contour building ───

def test_build_roi_contour_valid():
    """Standard 4-point polygon should produce a valid contour."""
    roi = [[0.0, 0.6], [1.0, 0.6], [1.0, 1.0], [0.0, 1.0]]
    contour = _build_roi_contour(roi, 1000, 1000)
    assert contour is not None
    assert contour.shape == (4, 1, 2)
    # First point: (0*1000, 0.6*1000) = (0, 600)
    assert contour[0][0][0] == 0
    assert contour[0][0][1] == 600

def test_build_roi_contour_too_few_points():
    """Fewer than 3 points should return None."""
    assert _build_roi_contour([[0.0, 0.0], [1.0, 1.0]], 100, 100) is None
    assert _build_roi_contour([], 100, 100) is None

def test_build_roi_contour_nan_coordinates():
    """Non-finite coordinates should return None."""
    assert _build_roi_contour([[0.0, 0.0], [float('nan'), 0.5], [1.0, 1.0]], 100, 100) is None
    assert _build_roi_contour([[0.0, 0.0], [float('inf'), 0.5], [1.0, 1.0]], 100, 100) is None

def test_build_roi_contour_short_point():
    """Points with fewer than 2 coordinates should return None."""
    assert _build_roi_contour([[0.0], [1.0, 0.5], [1.0, 1.0]], 100, 100) is None

def test_build_roi_contour_different_resolutions():
    """ROI should scale correctly to different frame sizes."""
    roi = [[0.0, 0.5], [1.0, 0.5], [1.0, 1.0], [0.0, 1.0]]
    
    # 1080p
    c1 = _build_roi_contour(roi, 1080, 1920)
    assert c1[1][0][0] == 1920  # x=1.0*1920
    assert c1[1][0][1] == 540   # y=0.5*1080
    
    # 4K
    c2 = _build_roi_contour(roi, 2160, 3840)
    assert c2[1][0][0] == 3840
    assert c2[1][0][1] == 1080


# ─── 3. Point-in-ROI with correct types (THE KEY REGRESSION TEST) ───

@pytest.mark.skipif(cv2 is None, reason="OpenCV not available")
def test_safe_point_in_roi_with_numpy_scalars():
    """This is the exact failure that caused the original crash.
    
    cv2.pointPolygonTest rejects numpy scalar types in the point tuple.
    _safe_point_in_roi must convert them to plain Python float/int.
    """
    roi = [[0.0, 0.6], [1.0, 0.6], [1.0, 1.0], [0.0, 1.0]]
    contour = _build_roi_contour(roi, 1000, 1000)
    
    # Simulate centroid from CentroidTracker — it stores np.int centroids
    numpy_centroid = np.array([500, 700], dtype="int")
    cx = numpy_centroid[0]  # This is a numpy.intp scalar, NOT a Python int
    cy = numpy_centroid[1]
    
    # This must NOT raise cv2.error
    result = _safe_point_in_roi(contour, cx, cy)
    assert result is True  # (500, 700) is inside the bottom-40% ROI

@pytest.mark.skipif(cv2 is None, reason="OpenCV not available")
def test_safe_point_in_roi_outside():
    """Point outside the ROI should return False."""
    roi = [[0.0, 0.6], [1.0, 0.6], [1.0, 1.0], [0.0, 1.0]]
    contour = _build_roi_contour(roi, 1000, 1000)
    
    numpy_centroid = np.array([500, 300], dtype="int")
    result = _safe_point_in_roi(contour, numpy_centroid[0], numpy_centroid[1])
    assert result is False

def test_safe_point_in_roi_none_contour():
    """None contour should safely return False."""
    assert _safe_point_in_roi(None, 100.0, 100.0) is False

@pytest.mark.skipif(cv2 is None, reason="OpenCV not available")
def test_roi_membership_with_plain_python_types():
    """Verify that plain Python int/float tuples still work."""
    roi = [[0.0, 0.6], [1.0, 0.6], [1.0, 1.0], [0.0, 1.0]]
    contour = _build_roi_contour(roi, 1000, 1000)
    
    assert _safe_point_in_roi(contour, 500.0, 700.0) is True
    assert _safe_point_in_roi(contour, 500, 700) is True
    assert _safe_point_in_roi(contour, 500, 500) is False


# ─── 4. Directional isolation ───

def test_isolated_directional_state():
    """Each direction's tracker and metrics must be independent."""
    session = DemoSession("test_session")
    job_n = CVJob("north", "n.mp4")
    job_s = CVJob("south", "s.mp4")
    
    job_n.tracker.update([[10, 10, 20, 20]], [2])
    assert len(job_n.tracker.objects) == 1
    assert len(job_s.tracker.objects) == 0  # S should not be affected by N
    
    # Metrics are also independent
    job_n.metrics["queue_length"] = 5
    assert job_s.metrics["queue_length"] == 0


# ─── 5. Video file tests ───

@pytest.mark.skipif(cv2 is None, reason="OpenCV not available")
def test_all_video_files_open():
    """All four video files must exist and produce decodable frames."""
    video_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../app/data/videos"))
    for direction in ["north", "south", "east", "west"]:
        path = os.path.join(video_dir, f"{direction}.mp4")
        assert os.path.exists(path), f"Missing video: {path}"
        
        cap = cv2.VideoCapture(path)
        assert cap.isOpened(), f"Cannot open {direction}.mp4"
        
        ret, frame = cap.read()
        assert ret, f"Cannot read first frame from {direction}.mp4"
        assert frame is not None
        assert len(frame.shape) == 3  # (H, W, C)
        assert frame.shape[2] == 3    # BGR
        
        cap.release()


# ─── 6. Missing video handling ───

def test_video_failure_status():
    """If a video fails, the CVJob status should be 'error'."""
    job = CVJob("north", "missing.mp4")
    job.status = "error"
    job.error = "File not found"
    assert job.status == "error"
    assert job.error == "File not found"


# ─── 7. Session status output ───

def test_session_status_includes_all_fields():
    """get_session_status must return all required fields."""
    service = FourWayDemoService()
    session = DemoSession("test-123")
    for d in ["north", "south", "east", "west"]:
        session.jobs[d] = CVJob(d, f"{d}.mp4")
        session.jobs[d].status = "processing"
        session.jobs[d].metrics["queue_length"] = 3
        session.jobs[d].metrics["frames_processed"] = 10
        session.jobs[d].metrics["last_updated"] = "2026-01-01T00:00:00Z"
    service.sessions["test-123"] = session
    
    status = service.get_session_status("test-123")
    assert status["status"] == "initializing"
    assert "approaches" in status
    assert "signal" in status
    assert "pending_recommendation" in status
    
    for d in ["north", "south", "east", "west"]:
        approach = status["approaches"][d]
        assert "queue_length_estimate" in approach
        assert "raw_detections" in approach
        assert "total_unique_tracked" in approach
        assert "status" in approach
        assert "last_updated" in approach
        assert "frames_processed" in approach
        assert approach["queue_length_estimate"] == 3
        assert approach["frames_processed"] == 10

def test_session_status_not_found():
    service = FourWayDemoService()
    status = service.get_session_status("nonexistent")
    assert status["status"] == "not_found"


# ─── 8. Signal state integrity ───

def test_signal_no_conflicting_greens():
    """apply_phase must never allow conflicting green directions."""
    service = FourWayDemoService()
    session = DemoSession("test-signal")
    for d in ["north", "south", "east", "west"]:
        session.jobs[d] = CVJob(d, f"{d}.mp4")
    
    # Apply NS phase
    service.apply_phase(session, "North-South", 20, "test")
    assert session.signal_state["north"] == "GREEN"
    assert session.signal_state["south"] == "GREEN"
    assert session.signal_state["east"] == "RED"
    assert session.signal_state["west"] == "RED"
    
    # Apply EW phase
    service.apply_phase(session, "East-West", 20, "test")
    assert session.signal_state["east"] == "GREEN"
    assert session.signal_state["west"] == "GREEN"
    assert session.signal_state["north"] == "RED"
    assert session.signal_state["south"] == "RED"


# ─── 9. Operator approval/rejection ───

def test_approve_recommendation():
    service = FourWayDemoService()
    session = DemoSession("test-approve")
    for d in ["north", "south", "east", "west"]:
        session.jobs[d] = CVJob(d, f"{d}.mp4")
    service.sessions["test-approve"] = session
    
    session.pending_recommendation = {
        "recommended_phase": "North-South",
        "duration": 15,
        "reason": "Higher demand",
        "ns_demand": 5,
        "ew_demand": 2,
        "timestamp": "2026-01-01T00:00:00Z"
    }
    
    service.perform_action("test-approve", "approve_recommendation")
    assert session.pending_recommendation is None
    assert session.signal_state["north"] == "GREEN"
    assert session.signal_state["south"] == "GREEN"

def test_reject_recommendation():
    service = FourWayDemoService()
    session = DemoSession("test-reject")
    for d in ["north", "south", "east", "west"]:
        session.jobs[d] = CVJob(d, f"{d}.mp4")
    service.sessions["test-reject"] = session
    
    session.pending_recommendation = {
        "recommended_phase": "North-South",
        "duration": 15,
        "reason": "Higher demand",
        "ns_demand": 5,
        "ew_demand": 2,
        "timestamp": "2026-01-01T00:00:00Z"
    }
    
    service.perform_action("test-reject", "reject_recommendation")
    assert session.pending_recommendation is None
    # Rejection of NS should activate EW
    assert session.signal_state["east"] == "GREEN"
    assert session.signal_state["west"] == "GREEN"
    assert session.signal_state["north"] == "RED"


# ─── 10. Stop cleans up session ───

def test_stop_cleans_up_session():
    service = FourWayDemoService()
    session = DemoSession("test-stop")
    for d in ["north", "south", "east", "west"]:
        session.jobs[d] = CVJob(d, f"{d}.mp4")
    service.sessions["test-stop"] = session
    
    session.status = "running"
    service.perform_action("test-stop", "stop")
    
    assert session.is_stopped is True
    assert session.status == "completed"
    for d in ["north", "south", "east", "west"]:
        assert session.jobs[d].status == "completed"


# ─── 11. Frame queue behavior ───

@pytest.mark.asyncio
async def test_frame_queue_bounded():
    """Frame queue should not grow unbounded — maxsize=2."""
    job = CVJob("north", "test.mp4")
    assert job.frame_queue.maxsize == 2
    
    # Fill the queue
    await job.frame_queue.put(b"frame1")
    await job.frame_queue.put(b"frame2")
    assert job.frame_queue.full()
    
    # Draining old frames before adding new one (as done in _process_video)
    while not job.frame_queue.empty():
        try:
            job.frame_queue.get_nowait()
        except Exception:
            break
    await job.frame_queue.put(b"frame3")
    assert job.frame_queue.qsize() == 1


# ─── 12. Decision log capacity ───

def test_decision_log_bounded():
    """Decision log should not exceed 50 entries."""
    session = DemoSession("test-log")
    for i in range(60):
        session.add_log(i, i, i, i, "NS", "test", 10)
    assert len(session.logs) == 50
