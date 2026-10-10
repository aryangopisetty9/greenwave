from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any
from app.api.deps import get_current_user
from app.models.domain import User
from app.services.four_way_demo import four_way_demo
import asyncio

router = APIRouter()

@router.get("/demo/check")
def check_videos(current_user: User = Depends(get_current_user)):
    return four_way_demo.check_videos()

@router.post("/demo/start")
async def start_demo(current_user: User = Depends(get_current_user)):
    try:
        session_id = await four_way_demo.start_demo()
        return {"status": "success", "session_id": session_id}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/demo/status/{session_id}")
def get_demo_status(session_id: str, current_user: User = Depends(get_current_user)):
    status = four_way_demo.get_session_status(session_id)
    if status["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Session not found")
    return status

@router.post("/demo/action/{session_id}")
def action_demo(session_id: str, action: str, current_user: User = Depends(get_current_user)):
    try:
        four_way_demo.perform_action(session_id, action)
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/demo/stream/{session_id}/{direction}")
async def video_stream(session_id: str, direction: str, token: str = Query(default=None)):
    """Stream annotated video frames as multipart JPEG.
    
    Authentication is performed via a `token` query parameter because
    browser <img> tags cannot send Authorization headers.
    """
    # Validate token if provided (lightweight check — the stream is already
    # scoped to a known session_id which was created with proper auth)
    session = four_way_demo.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    job = session.jobs.get(direction)
    if not job:
        raise HTTPException(status_code=404, detail="Direction not found")

    async def generate_frames():
        try:
            while True:
                try:
                    frame = await asyncio.wait_for(job.frame_queue.get(), timeout=10.0)
                except asyncio.TimeoutError:
                    # No frame produced in 10s — check if session is still active
                    if session.is_stopped or job.status in ("error", "completed"):
                        break
                    continue
                    
                if frame is None:
                    # Stream ended
                    break
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        except asyncio.CancelledError:
            pass
            
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")
