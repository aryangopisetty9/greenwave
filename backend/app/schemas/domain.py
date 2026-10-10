from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models.domain import UserRole

# Users
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole
    is_active: bool = True
    district_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    state_id: Optional[int] = None
    district_name: Optional[str] = None
    state_name: Optional[str] = None
    badge_number: Optional[str] = None
    
    class Config:
        from_attributes = True

# Districts
class DistrictBase(BaseModel):
    name: str
    is_active: bool = True

class DistrictCreate(DistrictBase):
    pass

class DistrictResponse(DistrictBase):
    id: int
    
    class Config:
        from_attributes = True

class LocationDistrictResponse(BaseModel):
    id: int
    name: str
    state_id: Optional[int]

    class Config:
        from_attributes = True

class StateResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

# Cities
class CityResponse(BaseModel):
    id: int
    name: str
    district_id: int

    class Config:
        from_attributes = True

# Corridors
class CorridorBase(BaseModel):
    name: str

class CorridorCreate(CorridorBase):
    pass

class IntersectionResponse(BaseModel):
    id: int
    name: str
    lat: float
    lon: float

    class Config:
        from_attributes = True

class CorridorResponse(CorridorBase):
    id: int
    city_id: int
    intersections: list[IntersectionResponse] = []
    
    class Config:
        from_attributes = True

# Traffic Observations
class TrafficObservationBase(BaseModel):
    current_speed: Optional[float]
    free_flow_speed: Optional[float]
    current_travel_time: Optional[float]
    free_flow_travel_time: Optional[float]
    confidence: Optional[float]
    provider: str

class TrafficObservationResponse(TrafficObservationBase):
    id: int
    segment_id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True
