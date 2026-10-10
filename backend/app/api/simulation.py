from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any
import traceback

from app.services.simulation import simulation_service
from app.services.optimizer import optimizer_service
from app.api.deps import get_current_user
from app.models.domain import User

router = APIRouter()

class SimulationResult(BaseModel):
    status: str
    baseline: Dict[str, Any] = {}
    optimized: Dict[str, Any] = {}
    error: str = None

@router.post("/run", response_model=SimulationResult)
def run_full_simulation(current_user: User = Depends(get_current_user)):
    try:
        # Run baseline
        baseline_results = simulation_service.run_simulation()
        
        # Run optimization search
        optimized_timings = optimizer_service.generate_optimized_timings(evaluator_fn=simulation_service.run_simulation)
        
        # Run optimized simulation (the final run with the best timing)
        optimized_results = simulation_service.run_simulation(optimized_timings=optimized_timings)
        
        # Serialize timings for JSON response
        serialized_timings = {}
        for tls_id, phases in optimized_timings.items():
            serialized_timings[tls_id] = [{"duration": p.duration, "state": p.state} for p in phases]
            
        return SimulationResult(
            status="success",
            baseline=baseline_results,
            optimized=optimized_results,
            # we could add timings here if we wanted to display them
        )
    except Exception as e:
        return SimulationResult(
            status="error",
            error=str(e) + "\n" + traceback.format_exc()
        )

@router.post("/optimize")
def run_optimization_only(current_user: User = Depends(get_current_user)):
    try:
        optimized_timings = optimizer_service.generate_optimized_timings(evaluator_fn=simulation_service.run_simulation)
        
        serialized_timings = {}
        for tls_id, phases in optimized_timings.items():
            serialized_timings[tls_id] = [{"duration": p.duration, "state": p.state} for p in phases]
            
        return {
            "status": "success",
            "timings": serialized_timings
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e) + "\n" + traceback.format_exc()
        }
