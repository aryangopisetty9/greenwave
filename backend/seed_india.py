import json
import urllib.request
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine, Base
from app.models.domain import State, District, City, Corridor, Intersection
import os

def init_db():
    print("Creating database tables if they don't exist...")
    Base.metadata.create_all(bind=engine)

def seed_india_data():
    db = SessionLocal()
    try:
        print("Checking if India data is already seeded...")
        if db.query(State).count() > 30:
            print("India states already seeded. Continuing to demo seeding.")
            # We don't return here so we can seed the demo city
            pass
        else:
            print("Fetching India states and districts...")
            # Using a reliable public JSON file for Indian states and districts
            url = "https://raw.githubusercontent.com/sab99r/Indian-States-And-Districts/master/states-and-districts.json"
            
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                
            print(f"Imported {len(data['states'])} states.")
            
            # We need to deduplicate states and handle them
            state_cache = {}
            for item in data['states']:
                state_name = item['state']
                districts = item['districts']
                
                # Check if state exists
                db_state = db.query(State).filter(State.name == state_name).first()
                if not db_state:
                    db_state = State(name=state_name, is_active=True)
                    db.add(db_state)
                    db.flush() # get id
                    
                for dist_name in districts:
                    # Add district
                    db_dist = db.query(District).filter(District.name == dist_name, District.state_id == db_state.id).first()
                    if not db_dist:
                        db_dist = District(name=dist_name, state_id=db_state.id, is_active=True)
                        db.add(db_dist)
                        
            db.commit()
            print("Successfully seeded all States and Districts from dataset.")
        
        # Add a sample city and corridor so the demo works
        karnataka = db.query(State).filter(State.name == "Karnataka").first()
        if karnataka:
            bengaluru = db.query(District).filter(District.name == "Bengaluru Urban", District.state_id == karnataka.id).first()
            if bengaluru:
                print("Seeding sample city and corridor in Bengaluru...")
                city = db.query(City).filter(City.name == "Bengaluru", City.district_id == bengaluru.id).first()
                if not city:
                    city = City(name="Bengaluru", district_id=bengaluru.id)
                    db.add(city)
                    db.flush()
                
                corr = db.query(Corridor).filter(Corridor.name == "Koramangala 100ft Road", Corridor.city_id == city.id).first()
                if not corr:
                    corr = Corridor(name="Koramangala 100ft Road", city_id=city.id)
                    db.add(corr)
                    db.flush()
                    
                    # Intersections
                    intersections = [
                        {"name": "Sony World Junction", "lat": 12.9344, "lon": 77.6256},
                        {"name": "Wipro Park Junction", "lat": 12.9304, "lon": 77.6268},
                        {"name": "Maharaja Signal", "lat": 12.9378, "lon": 77.6254},
                        {"name": "Koramangala BDA Junction", "lat": 12.9312, "lon": 77.6260}
                    ]
                    for idx, inter in enumerate(intersections):
                        db_int = Intersection(
                            corridor_id=corr.id,
                            name=inter["name"],
                            lat=inter["lat"],
                            lon=inter["lon"]
                        )
                        db.add(db_int)
                
                db.commit()
                print("Successfully seeded sample city and corridor.")
                
    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    seed_india_data()
