import asyncio
import httpx
import argparse
import logging
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.domain import District, City, Corridor, Intersection, State

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OVERPASS_URL = "http://overpass-api.de/api/interpreter"

async def fetch_osm_data(query: str):
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OVERPASS_URL, 
            data={'data': query}, 
            headers={"User-Agent": "GreenWave-CityOptimizer/1.0"}
        )
        response.raise_for_status()
        return response.json()

async def import_district(district_id: int, explicit_lat: float = None, explicit_lon: float = None, radius: int = 500):
    db: Session = SessionLocal()
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        logger.error(f"District {district_id} not found.")
        return
    
    state = db.query(State).filter(State.id == district.state_id).first()
    area_name = district.name
    state_name = state.name if state else ""
    
    logger.info(f"Importing data for {area_name}, {state_name}...")
    
    lat, lon = explicit_lat, explicit_lon
    
    if lat is None or lon is None:
        import urllib.parse
        logger.info("Fetching city coordinates via Nominatim...")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"https://nominatim.openstreetmap.org/search?city={urllib.parse.quote(area_name)}&state={urllib.parse.quote(state_name)}&country=India&format=json"
                res = await client.get(url, headers={"User-Agent": "GreenWave-CityOptimizer/1.0"})
                if res.status_code == 200 and res.json():
                    lat = float(res.json()[0]["lat"])
                    lon = float(res.json()[0]["lon"])
                else:
                    logger.error("Could not find coordinates for city.")
                    return
        except Exception as e:
            logger.error(f"Nominatim error: {e}")
            return

    logger.info(f"Center coordinates: {lat}, {lon}. Querying OSM around a {radius}m radius...")
    
    roads_query = f"""
    [out:json][timeout:25];
    (
      way["highway"~"primary|secondary"](around:{radius},{lat},{lon});
      node["highway"="traffic_signals"](around:{radius},{lat},{lon});
    );
    out geom qt;
    """
    
    try:
        road_data = await fetch_osm_data(roads_query)
        elements = road_data.get("elements", [])
        
        city = db.query(City).filter(City.name == area_name, City.district_id == district.id).first()
        if not city:
            city = City(name=area_name, district_id=district.id)
            db.add(city)
            db.commit()
            db.refresh(city)
        default_city_id = city.id

        ways = [el for el in elements if el["type"] == "way"]
        nodes = {el["id"]: el for el in elements if el["type"] == "node"}
        signals = [el for el in elements if el["type"] == "node" and el.get("tags", {}).get("highway") == "traffic_signals"]
        
        logger.info(f"Found {len(ways)} roads and {len(signals)} traffic signals.")
        
        # Insert roads
        corridor_count = 0
        for way in ways:
            name = way.get("tags", {}).get("name")
            if not name:
                continue
                
            corridor = db.query(Corridor).filter(Corridor.name == name, Corridor.city_id == default_city_id).first()
            if not corridor:
                corridor = Corridor(name=name, city_id=default_city_id)
                db.add(corridor)
                db.commit()
                db.refresh(corridor)
                corridor_count += 1
                
        import math
        def haversine(lat1, lon1, lat2, lon2):
            if lat1 is None or lon1 is None or lat2 is None or lon2 is None: return float('inf')
            R = 6371000
            phi_1, phi_2 = math.radians(lat1), math.radians(lat2)
            delta_phi = math.radians(lat2 - lat1)
            delta_lambda = math.radians(lon2 - lon1)
            a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi_1) * math.cos(phi_2) * math.sin(delta_lambda / 2.0) ** 2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return R * c

        intersection_count = 0
        unmatched_count = 0
        matched_signals = set()
        
        for sig in signals:
            sig_id = sig["id"]
            sig_lat = sig.get("lat")
            sig_lon = sig.get("lon")
            best_dist = float('inf')
            best_way = None
            
            # Find the closest way
            for way in ways:
                way_name = way.get("tags", {}).get("name")
                if not way_name:
                    continue
                # Check point to node distance for all nodes in the way
                for point in way.get("geometry", []):
                    d = haversine(sig_lat, sig_lon, point.get("lat"), point.get("lon"))
                    if d < best_dist:
                        best_dist = d
                        best_way = way
                            
            # Configurable tolerance: 30 meters
            if best_dist <= 30.0 and best_way:
                way_name = best_way.get("tags", {}).get("name")
                corridor = db.query(Corridor).filter(Corridor.name == way_name, Corridor.city_id == default_city_id).first()
                if corridor:
                    intersection_name = f"Signal at {way_name}"
                    inter = db.query(Intersection).filter(Intersection.corridor_id == corridor.id, Intersection.lat == sig_lat, Intersection.lon == sig_lon).first()
                    if not inter:
                        inter = Intersection(
                            name=intersection_name, 
                            corridor_id=corridor.id, 
                            lat=sig_lat, 
                            lon=sig_lon,
                            source="osm",
                            is_verified=False,
                            match_distance=best_dist
                        )
                        db.add(inter)
                        db.commit()
                        intersection_count += 1
                        matched_signals.add(sig_id)
            else:
                unmatched_count += 1
                
        logger.info(f"Successfully imported {corridor_count} roads. Matched {intersection_count} signals. Unmatched {len(signals) - intersection_count} signals.")
        
    except Exception as e:
        logger.error(f"Failed to import OSM data: {e}")
        
    db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import OSM Data for a given District")
    parser.add_argument("district_id", type=int, help="ID of the District to import")
    parser.add_argument("--lat", type=float, help="Explicit latitude center")
    parser.add_argument("--lon", type=float, help="Explicit longitude center")
    parser.add_argument("--radius", type=int, default=500, help="Search radius in meters")
    args = parser.parse_args()
    
    asyncio.run(import_district(args.district_id, args.lat, args.lon, args.radius))
