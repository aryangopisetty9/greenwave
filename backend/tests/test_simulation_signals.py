import pytest
import time
from datetime import datetime
from app.services.four_way_demo import (
    FourWayDemoService, DemoSession, CVJob
)

def test_backend_session_status_transition_states():
    """Verify backend calculates and returns transition_state, active_phase, and remaining_seconds."""
    service = FourWayDemoService()
    session = DemoSession("test-transitions")
    session.status = "running"
    for d in ["north", "south", "east", "west"]:
        session.jobs[d] = CVJob(d, f"{d}.mp4")
    service.sessions["test-transitions"] = session

    # 1. NS Green
    service.apply_phase(session, "North-South", 20, "Test NS")
    status = service.get_session_status("test-transitions")
    assert status["active_phase"] == "North-South"
    assert status["transition_state"] == "GREEN"
    assert status["signal"]["north"] == "GREEN"
    assert status["signal"]["south"] == "GREEN"
    assert status["signal"]["east"] == "RED"
    assert status["signal"]["west"] == "RED"
    assert status["remaining_seconds"] is not None
    assert status["remaining_seconds"] <= 20

    # 2. EW Green
    service.apply_phase(session, "East-West", 15, "Test EW")
    status = service.get_session_status("test-transitions")
    assert status["active_phase"] == "East-West"
    assert status["transition_state"] == "GREEN"
    assert status["signal"]["east"] == "GREEN"
    assert status["signal"]["west"] == "GREEN"
    assert status["signal"]["north"] == "RED"
    assert status["signal"]["south"] == "RED"

    # 3. Yellow clearance
    session.in_clearance = True
    session.signal_state["east"] = "YELLOW"
    session.signal_state["west"] = "YELLOW"
    status = service.get_session_status("test-transitions")
    assert status["transition_state"] == "YELLOW"

    # 4. ALL-RED clearance
    session.signal_state = {k: "RED" for k in ["north", "south", "east", "west"]}
    status = service.get_session_status("test-transitions")
    assert status["transition_state"] == "ALL-RED"

    # 5. Pending operator approval
    session.pending_recommendation = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "recommended_phase": "North-South",
        "duration": 25,
        "reason": "Test approval",
        "ns_demand": 6,
        "ew_demand": 1
    }
    status = service.get_session_status("test-transitions")
    assert status["transition_state"] == "WAITING FOR APPROVAL"
    # When waiting for approval, signals must remain safe ALL-RED
    assert all(sig == "RED" for sig in status["signal"].values())
    assert status["remaining_seconds"] is None

def test_backend_approaches_metric_distinction():
    """Verify backend approaches provide currently_tracked, cumulative_track_ids, raw_detections."""
    service = FourWayDemoService()
    session = DemoSession("test-metrics")
    for d in ["north", "south", "east", "west"]:
        session.jobs[d] = CVJob(d, f"{d}.mp4")
        session.jobs[d].metrics["queue_length"] = 0 # valid zero queue
        session.jobs[d].metrics["raw_detections_per_frame"] = 5
        session.jobs[d].metrics["currently_tracked"] = 3
        session.jobs[d].metrics["total_detected"] = 12
        session.jobs[d].metrics["frames_processed"] = 20
        session.jobs[d].metrics["last_updated"] = datetime.utcnow().isoformat() + "Z"
    service.sessions["test-metrics"] = session

    status = service.get_session_status("test-metrics")
    for d in ["north", "south", "east", "west"]:
        app = status["approaches"][d]
        assert app["queue_length_estimate"] == 0
        assert app["raw_detections"] == 5
        assert app["currently_tracked"] == 3
        assert app["cumulative_track_ids"] == 12
        assert app["frames_processed"] == 20

def test_backend_missing_approach_reported_as_unavailable():
    """Verify that a missing job reports status 'unavailable'."""
    service = FourWayDemoService()
    session = DemoSession("test-missing")
    # Only north exists, others missing
    session.jobs["north"] = CVJob("north", "north.mp4")
    service.sessions["test-missing"] = session

    status = service.get_session_status("test-missing")
    assert status["approaches"]["north"]["status"] == "starting"
    assert status["approaches"]["south"]["status"] == "unavailable"
    assert status["approaches"]["east"]["status"] == "unavailable"
    assert status["approaches"]["west"]["status"] == "unavailable"
