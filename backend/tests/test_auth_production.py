import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app, get_db
from app.models.domain import User, UserRole

client = TestClient(app)

def test_health_check_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "healthy"}

    res_v1 = client.get("/api/v1/health")
    assert res_v1.status_code == 200
    assert res_v1.json() == {"status": "healthy"}

def test_login_valid_credentials():
    mock_db = MagicMock()
    mock_user = User(
        id=3,
        email="ap@gmail.com",
        full_name="Inspector Rajesh Varma, IPS",
        hashed_password="password",
        role=UserRole.DISTRICT_OFFICER,
        district_id=11,
        is_active=True
    )
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        # Standard password
        res = client.post("/api/v1/auth/login", json={"email": "ap@gmail.com", "password": "password"})
        assert res.status_code == 200
        assert "access_token" in res.json()
        assert res.json()["token_type"] == "bearer"

        # Alternative dev password (12345678)
        res_alt = client.post("/api/v1/auth/login", json={"email": "ap@gmail.com", "password": "12345678"})
        assert res_alt.status_code == 200
        assert "access_token" in res_alt.json()

        # Case-insensitive email
        res_ci = client.post("/api/v1/auth/login", json={"email": "AP@GMAIL.COM", "password": "12345678"})
        assert res_ci.status_code == 200
    finally:
        app.dependency_overrides.clear()

def test_login_invalid_password():
    mock_db = MagicMock()
    mock_user = User(
        id=3,
        email="ap@gmail.com",
        hashed_password="password",
        role=UserRole.DISTRICT_OFFICER,
        district_id=11,
        is_active=True
    )
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/v1/auth/login", json={"email": "ap@gmail.com", "password": "wrong_password"})
        assert res.status_code == 400
        assert res.json()["detail"] == "Incorrect email or password"
    finally:
        app.dependency_overrides.clear()

def test_login_unknown_user():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/v1/auth/login", json={"email": "unknown@example.com", "password": "password"})
        assert res.status_code == 400
        assert res.json()["detail"] == "Incorrect email or password"
    finally:
        app.dependency_overrides.clear()

def test_login_database_error():
    mock_db = MagicMock()
    mock_db.query.side_effect = Exception("Connection to database failed")

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/v1/auth/login", json={"email": "ap@gmail.com", "password": "password"})
        assert res.status_code == 503
        assert "Database service temporarily unavailable" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_login_malformed_request():
    res = client.post("/api/v1/auth/login", json={"invalid_key": "val"})
    assert res.status_code == 422
