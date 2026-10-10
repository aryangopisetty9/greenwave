import json
from app.db.database import SessionLocal
from app.models.domain import State, District

def seed():
    db = SessionLocal()
    
    with open("app/data/locations.json") as f:
        data = json.load(f)
        
    for s in data["states"]:
        state = db.query(State).filter_by(id=s["id"]).first()
        if not state:
            state = State(id=s["id"], name=s["name"])
            db.add(state)
            
    for d in data.get("districts", []):
        district = db.query(District).filter_by(id=d["id"]).first()
        if not district:
            district = District(id=d["id"], state_id=d["state_id"], name=d["name"])
            db.add(district)
    db.commit()

    from app.models.domain import Corridor, Intersection
    for c in data.get("corridors", []):
        corridor = db.query(Corridor).filter_by(id=c["id"]).first()
        if not corridor:
            corridor = Corridor(id=c["id"], district_id=c["district_id"], name=c["name"])
            db.add(corridor)
            db.commit()
            
            for i in c.get("intersections", []):
                intersection = Intersection(id=i["id"], corridor_id=c["id"], name=i["name"], lat=i["lat"], lon=i["lon"])
                db.add(intersection)
            db.commit()
    db.close()
    print("Seed complete")

if __name__ == "__main__":
    seed()
