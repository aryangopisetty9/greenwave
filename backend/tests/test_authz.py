import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app, get_current_user, get_db
from app.models.domain import UserRole, User, District, State, City, Corridor

client = TestClient(app)

def setup_mock_db():
    mock_db = MagicMock()
    return mock_db

def test_public_state_district():
    # States and districts are now public
    response = client.get("/api/v1/locations/states")
    assert response.status_code == 200
    
    response = client.get("/api/v1/locations/states/1/districts")
    assert response.status_code == 200

def test_operator_unauthorized_city():
    mock_db = setup_mock_db()
    operator_user = User(id=2, email="op@example.com", role=UserRole.DISTRICT_OFFICER, district_id=1)
    
    app.dependency_overrides[get_current_user] = lambda: operator_user
    app.dependency_overrides[get_db] = lambda: mock_db
    
    # Try accessing city 99 in district 2
    response = client.get("/api/v1/locations/districts/2/cities")
    assert response.status_code == 200
    assert response.json() == []

def test_admin_access():
    mock_db = setup_mock_db()
    admin_user = User(id=1, email="admin@example.com", role=UserRole.GLOBAL_ADMIN, district_id=None)
    
    # Mock data
    mock_state = State(id=1, name="State 1")
    mock_district = District(id=2, name="Dist 2", state_id=1)
    
    def mock_query(model):
        m = MagicMock()
        if model == State:
            m.all.return_value = [mock_state]
        elif model == District:
            m.filter.return_value.all.return_value = [mock_district]
        return m
        
    mock_db.query.side_effect = mock_query
    
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.get("/api/v1/locations/states")
    assert response.status_code == 200
    
    response = client.get("/api/v1/locations/states/1/districts")
    assert response.status_code == 200
