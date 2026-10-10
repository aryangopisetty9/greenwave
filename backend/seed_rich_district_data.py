from app.db.database import SessionLocal
from app.models.domain import (
    User, UserRole, UserScope, State, District, City, OperationalZone,
    Corridor, RoadSegment, Intersection, TrafficObservation, DemoSession, DemoDecision
)
from datetime import datetime, timedelta
import random

db = SessionLocal()

print("--- Seeding Rich District Traffic Operations Data ---")

# 1. Update/Ensure AP Officer user
ap_user = db.query(User).filter(User.email == "ap@gmail.com").first()
if not ap_user:
    ap_user = User(
        email="ap@gmail.com",
        full_name="Inspector Rajesh Varma, IPS",
        hashed_password="password",
        role=UserRole.DISTRICT_OFFICER,
        district_id=11,
        is_active=True
    )
    db.add(ap_user)
    db.commit()
    db.refresh(ap_user)
else:
    ap_user.full_name = "Inspector Rajesh Varma, IPS"
    ap_user.district_id = 11
    ap_user.role = UserRole.DISTRICT_OFFICER
    db.commit()

# Ensure UserScope for ap_user
ap_scope = db.query(UserScope).filter(UserScope.user_id == ap_user.id).first()
if not ap_scope:
    ap_scope = UserScope(user_id=ap_user.id, district_id=11, state_id=6)
    db.add(ap_scope)
    db.commit()
else:
    ap_scope.district_id = 11
    ap_scope.state_id = 6
    db.commit()

# Also ensure operator@greenwave.com has name & scope
op_user = db.query(User).filter(User.email == "operator@greenwave.com").first()
if op_user:
    op_user.full_name = "Inspector Suresh Patil, IPS"
    op_user.district_id = 3
    db.commit()
    op_scope = db.query(UserScope).filter(UserScope.user_id == op_user.id).first()
    if not op_scope:
        db.add(UserScope(user_id=op_user.id, district_id=3, state_id=2))
        db.commit()

# 2. Seed City for Guntur District (11)
guntur_city = db.query(City).filter(City.district_id == 11).first()
if not guntur_city:
    guntur_city = City(id=1101, district_id=11, name="Guntur")
    db.add(guntur_city)
    db.commit()
    db.refresh(guntur_city)
print(f"City: {guntur_city.name} (ID: {guntur_city.id})")

# 3. Seed Zones
zone1 = db.query(OperationalZone).filter(OperationalZone.id == 1101).first()
if not zone1:
    zone1 = OperationalZone(id=1101, city_id=guntur_city.id, name="Central Commercial Zone")
    db.add(zone1)

zone2 = db.query(OperationalZone).filter(OperationalZone.id == 1102).first()
if not zone2:
    zone2 = OperationalZone(id=1102, city_id=guntur_city.id, name="Administrative & Highway Zone")
    db.add(zone2)
db.commit()

# 4. Seed Corridors for Guntur
corridors_data = [
    (1101, "Arundelpet Main Commercial Arterial", zone1.id),
    (1102, "Brodipet 4th Line Arterial", zone1.id),
    (1103, "Lodge Center - Collectorate Highway", zone2.id),
    (1104, "NTR Stadium Transit Expressway", zone2.id),
]

for c_id, c_name, z_id in corridors_data:
    corr = db.query(Corridor).filter(Corridor.id == c_id).first()
    if not corr:
        corr = Corridor(id=c_id, city_id=guntur_city.id, zone_id=z_id, name=c_name)
        db.add(corr)
db.commit()

# 5. Seed Intersections for Guntur (Traffic Signals)
intersections_data = [
    (1101, 1101, "Lodge Center Junction Signal", 16.3067, 80.4365, "OSM", True),
    (1102, 1101, "Brodipet 4th Line Traffic Signal", 16.3012, 80.4421, "OSM", True),
    (1103, 1102, "Arundelpet 5/1 Traffic Signal", 16.2985, 80.4480, "OSM", True),
    (1104, 1102, "Collectorate Circle Signal", 16.3120, 80.4390, "OSM", True),
    (1105, 1103, "NTR Stadium Crossing Signal", 16.3185, 80.4320, "OSM", True),
    (1106, 1103, "Old Bus Stand Circle Signal", 16.3045, 80.4510, "OSM", True),
    (1107, 1104, "Amaravathi Road Signal", 16.3210, 80.4280, "OSM", True),
    (1108, 1104, "Chuttugunta Traffic Junction", 16.2920, 80.4560, "OSM", True),
]

for i_id, c_id, name, lat, lon, source, is_v in intersections_data:
    inter = db.query(Intersection).filter(Intersection.id == i_id).first()
    if not inter:
        inter = Intersection(
            id=i_id,
            corridor_id=c_id,
            name=name,
            lat=lat,
            lon=lon,
            source=source,
            is_verified=is_v,
            verified_by_id=ap_user.id,
            verified_at=datetime.utcnow()
        )
        db.add(inter)
    else:
        inter.name = name
        inter.corridor_id = c_id
        inter.lat = lat
        inter.lon = lon
        inter.is_verified = True
db.commit()
print("Seeded 8 Intersections in Guntur District.")

# 6. Seed Demo Sessions & Decisions for Analytics
existing_sessions = db.query(DemoSession).filter(DemoSession.user_id == ap_user.id).all()
if len(existing_sessions) < 5:
    now = datetime.utcnow()
    for s_idx in range(5):
        s_id = f"demo-session-gt-{s_idx+1}"
        sess = db.query(DemoSession).filter(DemoSession.id == s_id).first()
        if not sess:
            sess = DemoSession(
                id=s_id,
                user_id=ap_user.id,
                intersection_id=1101 + s_idx,
                start_time=now - timedelta(hours=6 - s_idx),
                end_time=now - timedelta(hours=5 - s_idx),
                status="completed"
            )
            db.add(sess)
            db.commit()
            
            # Decisions for this session
            for d_idx in range(8):
                t_stamp = sess.start_time + timedelta(minutes=d_idx*7)
                ns_q = random.randint(8, 28)
                ew_q = random.randint(6, 24)
                sel_phase = "NS" if ns_q >= ew_q else "EW"
                duration = random.randint(35, 65)
                decision = DemoDecision(
                    session_id=s_id,
                    timestamp=t_stamp,
                    selected_phase=sel_phase,
                    reason=f"Adaptive priority based on queue imbalance (NS: {ns_q}, EW: {ew_q})",
                    duration=duration,
                    north_queue_input=ns_q // 2 + 2,
                    south_queue_input=ns_q // 2,
                    east_queue_input=ew_q // 2 + 1,
                    west_queue_input=ew_q // 2
                )
                db.add(decision)
            db.commit()
    print("Seeded 5 Demo Sessions with 40 Decisions for Analytics.")

db.close()
print("--- Database Seeding Complete ---")
