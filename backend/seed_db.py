import os
import sys

# Add backend dir to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal, engine
from app.models.domain import Base, User, UserRole, District, Corridor, RoadSegment, Intersection

def seed():
    db = SessionLocal()
    try:
        # Create a district
        if not db.query(District).first():
            d1 = District(name="Downtown Core")
            db.add(d1)
            db.commit()
            db.refresh(d1)
            
            # Create a corridor
            c1 = Corridor(name="Main St. Corridor", district_id=d1.id)
            db.add(c1)
            db.commit()
            db.refresh(c1)
            
            # Segments and intersections
            s1 = RoadSegment(name="Main St 100 Block", corridor_id=c1.id, start_lat=40.7128, start_lon=-74.0060, end_lat=40.7138, end_lon=-74.0065)
            i1 = Intersection(name="Main & 1st", corridor_id=c1.id, lat=40.7138, lon=-74.0065)
            db.add(s1)
            db.add(i1)
            db.commit()

        # Create admin
        if not db.query(User).filter(User.email == "admin@greenwave.com").first():
            admin = User(email="admin@greenwave.com", hashed_password="password", role=UserRole.ADMIN)
            db.add(admin)
        
        # Create operator
        if not db.query(User).filter(User.email == "operator@greenwave.com").first():
            d1 = db.query(District).first()
            op = User(email="operator@greenwave.com", hashed_password="password", role=UserRole.OPERATOR, district_id=d1.id if d1 else None)
            db.add(op)
        
        db.commit()
        print("Database seeded with dev accounts: admin@greenwave.com / password and operator@greenwave.com / password")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
