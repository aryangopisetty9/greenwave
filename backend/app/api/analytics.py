from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List

from app.db.database import get_db
from app.models.domain import DemoSession, DemoMeasurement, DemoDecision, User
from app.api.deps import get_current_user
from app.core.authz import apply_geographic_scope

router = APIRouter()

@router.get("/summary")
def get_analytics_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q_session = apply_geographic_scope(db.query(DemoSession), DemoSession, current_user, db)
    
    total_sessions = q_session.count()
    completed_sessions = q_session.filter(DemoSession.status == "completed").count()
    
    # Get all decisions for charts
    # Apply scope by joining to DemoSession
    q_decision = db.query(DemoDecision).join(DemoSession)
    q_decision = apply_geographic_scope(q_decision, DemoSession, current_user, db)
    decisions = q_decision.order_by(DemoDecision.timestamp.desc()).limit(100).all()
    
    decision_history = []
    for d in reversed(decisions):
        decision_history.append({
            "timestamp": d.timestamp.isoformat() + "Z",
            "phase": d.selected_phase,
            "duration": d.duration,
            "ns_demand": d.north_queue_input + d.south_queue_input,
            "ew_demand": d.east_queue_input + d.west_queue_input
        })
        
    return {
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "decision_history": decision_history
    }
