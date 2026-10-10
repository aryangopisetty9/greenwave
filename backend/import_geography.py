import json
import argparse
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine
from app.models.domain import Country, State, District, City, OperationalZone, Corridor, Intersection
from app.models.domain import Base

def validate_coords(lat: float, lon: float) -> bool:
    if lat is None or lon is None:
        return False
    return -90 <= lat <= 90 and -180 <= lon <= 180

def import_geography(file_path: str):
    db: Session = SessionLocal()
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            
        stats = {'imported': 0, 'skipped': 0, 'failed': 0}
        
        for c_data in data.get('countries', []):
            try:
                # Import Country
                country = db.query(Country).filter(Country.iso_code == c_data['iso_code']).first()
                if not country:
                    country = Country(
                        name=c_data['name'], 
                        iso_code=c_data['iso_code'],
                        level_1_name=c_data.get('level_1_name', 'State'),
                        level_2_name=c_data.get('level_2_name', 'District'),
                        level_3_name=c_data.get('level_3_name', 'City')
                    )
                    db.add(country)
                    db.flush()
                    stats['imported'] += 1
                else:
                    stats['skipped'] += 1

                for s_data in c_data.get('states', []):
                    state = db.query(State).filter(State.name == s_data['name'], State.country_id == country.id).first()
                    if not state:
                        state = State(name=s_data['name'], country_id=country.id)
                        db.add(state)
                        db.flush()
                        stats['imported'] += 1
                    else:
                        stats['skipped'] += 1

                    for d_data in s_data.get('districts', []):
                        district = db.query(District).filter(District.name == d_data['name'], District.state_id == state.id).first()
                        if not district:
                            district = District(name=d_data['name'], state_id=state.id)
                            db.add(district)
                            db.flush()
                            stats['imported'] += 1
                        else:
                            stats['skipped'] += 1

                        for city_data in d_data.get('cities', []):
                            city = db.query(City).filter(City.name == city_data['name'], City.district_id == district.id).first()
                            if not city:
                                city = City(name=city_data['name'], district_id=district.id)
                                db.add(city)
                                db.flush()
                                stats['imported'] += 1
                            else:
                                stats['skipped'] += 1
                                
                            for zone_data in city_data.get('zones', []):
                                zone = db.query(OperationalZone).filter(OperationalZone.name == zone_data['name'], OperationalZone.city_id == city.id).first()
                                if not zone:
                                    zone = OperationalZone(name=zone_data['name'], city_id=city.id)
                                    db.add(zone)
                                    db.flush()
                                    stats['imported'] += 1
                                else:
                                    stats['skipped'] += 1
                                    
                                for corr_data in zone_data.get('corridors', []):
                                    corr = db.query(Corridor).filter(Corridor.name == corr_data['name'], Corridor.zone_id == zone.id).first()
                                    if not corr:
                                        corr = Corridor(name=corr_data['name'], city_id=city.id, zone_id=zone.id)
                                        db.add(corr)
                                        db.flush()
                                        stats['imported'] += 1
                                    else:
                                        stats['skipped'] += 1
                                        
                                    for int_data in corr_data.get('intersections', []):
                                        if not validate_coords(int_data.get('lat'), int_data.get('lon')):
                                            print(f"Invalid coordinates for intersection {int_data.get('name')}")
                                            stats['failed'] += 1
                                            continue
                                            
                                        inter = db.query(Intersection).filter(
                                            Intersection.name == int_data['name'], 
                                            Intersection.corridor_id == corr.id
                                        ).first()
                                        if not inter:
                                            inter = Intersection(
                                                name=int_data['name'],
                                                lat=int_data['lat'],
                                                lon=int_data['lon'],
                                                corridor_id=corr.id,
                                                source=int_data.get('source', 'import')
                                            )
                                            db.add(inter)
                                            stats['imported'] += 1
                                        else:
                                            stats['skipped'] += 1

            except Exception as e:
                print(f"Failed importing country {c_data.get('name')}: {e}")
                stats['failed'] += 1
                
        db.commit()
        print("\n--- Import Complete ---")
        print(f"Imported: {stats['imported']} records")
        print(f"Skipped (already exists): {stats['skipped']} records")
        print(f"Failed: {stats['failed']} records")
        
    except Exception as e:
        db.rollback()
        print(f"Fatal error during import: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Import geographic data')
    parser.add_argument('file', help='JSON file containing geographic hierarchy')
    args = parser.parse_args()
    import_geography(args.file)
