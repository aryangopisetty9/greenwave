import httpx
from typing import Dict, Any, Optional
from datetime import datetime
from app.core.config import settings

class TrafficProvider:
    def __init__(self):
        self.api_key = settings.TRAFFIC_API_KEY
        self.provider = settings.TRAFFIC_PROVIDER

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key != "dev_key" and self.api_key != "")

    async def get_flow(self, point: str) -> Optional[Dict[str, Any]]:
        """Normalize source responses into a consistent internal schema."""
        if not self.is_configured():
            return None
        
        if self.provider == "tomtom":
            url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key={self.api_key}&point={point}&unit=KMPH"
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    response = await client.get(url)
                    response.raise_for_status()
                    data = response.json()
                    
                    if "flowSegmentData" in data:
                        flow = data["flowSegmentData"]
                        return {
                            "provider": "TomTom",
                            "current_speed": flow.get("currentSpeed"),
                            "free_flow_speed": flow.get("freeFlowSpeed"),
                            "current_travel_time": flow.get("currentTravelTime"),
                            "free_flow_travel_time": flow.get("freeFlowTravelTime"),
                            "confidence": flow.get("confidence"),
                            "retrieval_timestamp": datetime.utcnow().isoformat(),
                            "freshness": "live"
                        }
                    return None
                except httpx.RequestError as exc:
                    print(f"An error occurred while requesting {exc.request.url!r}.")
                    return None
                except httpx.HTTPStatusError as exc:
                    print(f"Error response {exc.response.status_code} while requesting {exc.request.url!r}.")
                    return None
        return None

    async def health_check(self) -> Dict[str, Any]:
        """Report whether a provider is configured and operational without exposing secrets."""
        if not self.is_configured():
            return {
                "status": "Not Configured",
                "reason": "Missing API Key",
                "operational": False,
                "provider": self.provider, 
                "has_credentials": False
            }
            
        if self.provider == "tomtom":
            # Test ping with a central India coordinate (Nagpur) just to verify credentials
            url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key={self.api_key}&point=21.1458,79.0882&unit=KMPH"
            async with httpx.AsyncClient(timeout=5.0) as client:
                try:
                    res = await client.get(url)
                    if res.status_code == 200:
                        return {
                            "status": "Configured", 
                            "operational": True,
                            "provider": self.provider, 
                            "has_credentials": True
                        }
                    elif res.status_code in (401, 403):
                        return {
                            "status": "Configured", 
                            "reason": "Invalid API Key or unauthorized",
                            "operational": False,
                            "provider": self.provider, 
                            "has_credentials": True
                        }
                    elif res.status_code == 429:
                        return {
                            "status": "Configured", 
                            "reason": "Rate limited by provider",
                            "operational": False,
                            "provider": self.provider, 
                            "has_credentials": True
                        }
                    else:
                        return {
                            "status": "Configured", 
                            "reason": f"Provider error {res.status_code}",
                            "operational": False,
                            "provider": self.provider, 
                            "has_credentials": True
                        }
                except Exception as e:
                    return {
                        "status": "Configured", 
                        "reason": "Timeout or connection error",
                        "operational": False,
                        "provider": self.provider, 
                        "has_credentials": True
                    }
                    
        return {
            "status": "Not Configured", 
            "reason": "Unknown provider",
            "operational": False,
            "provider": self.provider, 
            "has_credentials": True
        }

traffic_provider = TrafficProvider()
