from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import os

from app.db.database import get_db
from app.models.domain import DemoSession
from app.services.four_way_demo import four_way_demo
from app.services.traffic_provider import traffic_provider

from app.api.deps import get_current_user
from app.models.domain import DemoSession, User
from app.core.authz import apply_geographic_scope

router = APIRouter()

@router.get("")
async def get_alerts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alerts = []
    
    # 1. Video Source Alerts
    video_status = four_way_demo.check_videos()
    missing_videos = [d for d, exists in video_status.items() if not exists]
    if missing_videos:
        alerts.append({
            "id": "missing_video",
            "type": "error",
            "title": "Missing Video Source",
            "message": f"Missing required video files in app/data/videos/: {', '.join(missing_videos)}.mp4",
            "is_transient": True
        })
        
    # 2. Session Processing Failure
    q = apply_geographic_scope(db.query(DemoSession), DemoSession, current_user, db)
    failed_sessions = q.filter(DemoSession.status == "error").limit(5).all()
    for s in failed_sessions:
        alerts.append({
            "id": f"session_error_{s.id}",
            "type": "error",
            "title": "Session Processing Failure",
            "message": f"Demo session {s.id} terminated with an error.",
            "is_transient": False
        })
        
    # 3. Traffic Provider Alert
    traffic_status = await traffic_provider.health_check()
    if not traffic_status.get("operational"):
        alerts.append({
            "id": "traffic_provider_down",
            "type": "warning",
            "title": "Unavailable Traffic Measurements",
            "message": f"Traffic provider is not operational. Reason: {traffic_status.get('reason')}",
            "is_transient": True
        })
        
    # 4. CV Inference Failure
    # We can check if YOLO is loaded
    if four_way_demo.model is None:
        alerts.append({
            "id": "cv_inference_down",
            "type": "warning",
            "title": "CV Inference Unavailable",
            "message": "YOLOv8 model is not loaded in memory.",
            "is_transient": True
        })

    return alerts
