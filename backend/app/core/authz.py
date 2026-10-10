from sqlalchemy.orm import Session, Query
from app.models.domain import User, UserRole, UserScope, Country, State, District, City, OperationalZone, Corridor, Intersection, TrafficObservation, DemoSession, DemoDecision, DemoMeasurement

def apply_geographic_scope(query: Query, model, user: User, db: Session) -> Query:
    if user.role == UserRole.GLOBAL_ADMIN:
        return query
        
    scopes = db.query(UserScope).filter(UserScope.user_id == user.id).all()
    
    country_ids = [s.country_id for s in scopes if s.country_id]
    state_ids = [s.state_id for s in scopes if s.state_id]
    district_ids = [s.district_id for s in scopes if s.district_id]
    if user.district_id and user.district_id not in district_ids:
        district_ids.append(user.district_id)
    city_ids = [s.city_id for s in scopes if s.city_id]
    zone_ids = [s.zone_id for s in scopes if s.zone_id]

    if not any([country_ids, state_ids, district_ids, city_ids, zone_ids]):
        return query.filter(False)
        
    allowed_country_ids = set(country_ids)
    allowed_state_ids = set(state_ids)
    allowed_district_ids = set(district_ids)
    allowed_city_ids = set(city_ids)
    
    if allowed_country_ids:
        states = db.query(State.id).filter(State.country_id.in_(allowed_country_ids)).all()
        allowed_state_ids.update([s[0] for s in states])
        
    if allowed_state_ids:
        districts = db.query(District.id).filter(District.state_id.in_(allowed_state_ids)).all()
        allowed_district_ids.update([d[0] for d in districts])
        
    if allowed_district_ids:
        cities = db.query(City.id).filter(City.district_id.in_(allowed_district_ids)).all()
        allowed_city_ids.update([c[0] for c in cities])

    if model == Country:
        return query.filter(Country.id.in_(allowed_country_ids))
    elif model == State:
        return query.filter(State.id.in_(allowed_state_ids))
    elif model == District:
        return query.filter(District.id.in_(allowed_district_ids))
    elif model == City:
        return query.filter(City.id.in_(allowed_city_ids))
    elif model == Corridor:
        return query.join(City).filter(City.id.in_(allowed_city_ids))
    elif model == Intersection:
        # Avoid ambiguous join by specifying join conditions if needed, but simple join is usually fine
        return query.join(Corridor, Intersection.corridor_id == Corridor.id).join(City, Corridor.city_id == City.id).filter(City.id.in_(allowed_city_ids))
    elif model == DemoSession:
        return query.filter(DemoSession.user_id == user.id)
        
    return query
