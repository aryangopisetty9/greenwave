from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, DateTime, Enum
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    GLOBAL_ADMIN = "global_admin"
    NATIONAL_ADMIN = "national_admin"
    STATE_OFFICER = "state_officer"
    DISTRICT_OFFICER = "district_officer"
    ZONE_OFFICER = "zone_officer"
    
    # Legacy / SQLite uppercase values
    LEGACY_GLOBAL_ADMIN = "GLOBAL_ADMIN"
    LEGACY_NATIONAL_ADMIN = "NATIONAL_ADMIN"
    LEGACY_STATE_OFFICER = "STATE_OFFICER"
    LEGACY_DISTRICT_OFFICER = "DISTRICT_OFFICER"
    LEGACY_ZONE_OFFICER = "ZONE_OFFICER"
    LEGACY_ADMIN = "ADMIN"
    LEGACY_OPERATOR = "OPERATOR"

    @classmethod
    def normalize(cls, val):
        if isinstance(val, cls):
            val = val.value
        if isinstance(val, str):
            v = val.strip().lower()
            if v in ("admin", "global_admin"):
                return cls.GLOBAL_ADMIN
            if v in ("operator", "district_officer"):
                return cls.DISTRICT_OFFICER
            if v == "national_admin":
                return cls.NATIONAL_ADMIN
            if v == "state_officer":
                return cls.STATE_OFFICER
            if v == "zone_officer":
                return cls.ZONE_OFFICER
        return val

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="district_officer", nullable=False)
    is_active = Column(Boolean, default=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)

    district = relationship("District", back_populates="operators")
    scopes = relationship("UserScope", back_populates="user", cascade="all, delete-orphan")

class UserScope(Base):
    __tablename__ = "user_scopes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    state_id = Column(Integer, ForeignKey("states.id"), nullable=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=True)
    zone_id = Column(Integer, ForeignKey("operational_zones.id"), nullable=True)
    
    user = relationship("User", back_populates="scopes")

class Country(Base):
    __tablename__ = "countries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    iso_code = Column(String, unique=True, nullable=False)
    level_1_name = Column(String, default="State")
    level_2_name = Column(String, default="District")
    level_3_name = Column(String, default="City")
    is_active = Column(Boolean, default=True)

    states = relationship("State", back_populates="country", cascade="all, delete-orphan")

class State(Base):
    __tablename__ = "states"

    id = Column(Integer, primary_key=True, index=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    name = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    source_id = Column(String, nullable=True)
    source = Column(String, nullable=True)
    version = Column(String, nullable=True)
    retrieval_date = Column(DateTime, nullable=True)
    import_status = Column(String, nullable=True)

    country = relationship("Country", back_populates="states")
    districts = relationship("District", back_populates="state", cascade="all, delete-orphan")

class District(Base):
    __tablename__ = "districts"
    
    id = Column(Integer, primary_key=True, index=True)
    state_id = Column(Integer, ForeignKey("states.id"), nullable=True)
    name = Column(String, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    source_id = Column(String, nullable=True)
    source = Column(String, nullable=True)
    version = Column(String, nullable=True)
    retrieval_date = Column(DateTime, nullable=True)
    import_status = Column(String, nullable=True)
    
    state = relationship("State", back_populates="districts")
    
    operators = relationship("User", back_populates="district")
    cities = relationship("City", back_populates="district", cascade="all, delete-orphan")

class City(Base):
    __tablename__ = "cities"
    
    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    name = Column(String, index=True, nullable=False)
    source_id = Column(String, nullable=True)
    source = Column(String, nullable=True)
    retrieval_date = Column(DateTime, nullable=True)
    
    district = relationship("District", back_populates="cities")
    corridors = relationship("Corridor", back_populates="city", cascade="all, delete-orphan")
    zones = relationship("OperationalZone", back_populates="city", cascade="all, delete-orphan")

class OperationalZone(Base):
    __tablename__ = "operational_zones"
    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    name = Column(String, index=True, nullable=False)
    
    city = relationship("City", back_populates="zones")
    corridors = relationship("Corridor", back_populates="zone", cascade="all, delete-orphan")

class Corridor(Base):
    __tablename__ = "corridors"
    
    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    zone_id = Column(Integer, ForeignKey("operational_zones.id"), nullable=True)
    name = Column(String, nullable=False)
    source_id = Column(String, nullable=True)
    source = Column(String, nullable=True)
    retrieval_date = Column(DateTime, nullable=True)
    
    city = relationship("City", back_populates="corridors")
    zone = relationship("OperationalZone", back_populates="corridors")
    segments = relationship("RoadSegment", back_populates="corridor", cascade="all, delete-orphan")
    intersections = relationship("Intersection", back_populates="corridor", cascade="all, delete-orphan")

class RoadSegment(Base):
    __tablename__ = "road_segments"
    
    id = Column(Integer, primary_key=True, index=True)
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=False)
    name = Column(String, nullable=False)
    start_lat = Column(Float, nullable=False)
    start_lon = Column(Float, nullable=False)
    end_lat = Column(Float, nullable=False)
    end_lon = Column(Float, nullable=False)
    
    corridor = relationship("Corridor", back_populates="segments")
    observations = relationship("TrafficObservation", back_populates="segment", cascade="all, delete-orphan")

class Intersection(Base):
    __tablename__ = "intersections"
    
    id = Column(Integer, primary_key=True, index=True)
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=False)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    
    source = Column(String, nullable=True, default="manual")
    is_verified = Column(Boolean, default=False)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    match_distance = Column(Float, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    source_id = Column(String, nullable=True)
    retrieval_date = Column(DateTime, nullable=True)
    
    corridor = relationship("Corridor", back_populates="intersections")
    verified_by = relationship("User")

class TrafficObservation(Base):
    __tablename__ = "traffic_observations"
    
    id = Column(Integer, primary_key=True, index=True)
    segment_id = Column(Integer, ForeignKey("road_segments.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    current_speed = Column(Float, nullable=True) # km/h
    free_flow_speed = Column(Float, nullable=True) # km/h
    current_travel_time = Column(Float, nullable=True) # seconds
    free_flow_travel_time = Column(Float, nullable=True) # seconds
    confidence = Column(Float, nullable=True)
    provider = Column(String, nullable=False)
    
    segment = relationship("RoadSegment", back_populates="observations")

class DemoSession(Base):
    __tablename__ = "demo_sessions"
    
    id = Column(String, primary_key=True, index=True) # UUID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    intersection_id = Column(Integer, ForeignKey("intersections.id"), nullable=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    status = Column(String, default="running") # running, completed, error
    
    measurements = relationship("DemoMeasurement", back_populates="session", cascade="all, delete-orphan")
    decisions = relationship("DemoDecision", back_populates="session", cascade="all, delete-orphan")

class DemoMeasurement(Base):
    __tablename__ = "demo_measurements"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("demo_sessions.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    north_queue = Column(Integer, default=0)
    south_queue = Column(Integer, default=0)
    east_queue = Column(Integer, default=0)
    west_queue = Column(Integer, default=0)
    
    session = relationship("DemoSession", back_populates="measurements")

class DemoDecision(Base):
    __tablename__ = "demo_decisions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("demo_sessions.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    selected_phase = Column(String, nullable=False) # NS or EW
    reason = Column(String, nullable=False)
    duration = Column(Integer, nullable=False)
    north_queue_input = Column(Integer, default=0)
    south_queue_input = Column(Integer, default=0)
    east_queue_input = Column(Integer, default=0)
    west_queue_input = Column(Integer, default=0)
    
    session = relationship("DemoSession", back_populates="decisions")
