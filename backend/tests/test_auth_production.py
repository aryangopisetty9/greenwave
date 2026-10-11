import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app, get_db
from app.models.domain import User, UserRole

client = TestClient(app)

def test_health_check_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    res_v1 = client.get("/api/v1/health")
    assert res_v1.status_code == 200
    assert res_v1.json()["status"] == "healthy"

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

def test_signup_operator_successful():
    mock_db = MagicMock()
    # No existing user
    mock_db.query.return_value.filter.return_value.first.side_effect = [
        None,  # email check
        MagicMock(id=1, state_id=1)  # district check
    ]
    def assign_id(user):
        user.id = 10
        user.created_at = None
    mock_db.refresh.side_effect = assign_id
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        signup_payload = {
            "full_name": "Test Officer",
            "email": "officer@example.com",
            "password": "securepassword123",
            "state_id": 1,
            "district_id": 1
        }
        res = client.post("/api/v1/auth/signup", json=signup_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "officer@example.com"
        assert data["role"] == "district_officer"
        assert mock_db.commit.called
    finally:
        app.dependency_overrides.clear()

def test_signup_duplicate_email():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = MagicMock(id=99)
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        signup_payload = {
            "full_name": "Test Officer",
            "email": "existing@example.com",
            "password": "securepassword123",
            "state_id": 1,
            "district_id": 1
        }
        res = client.post("/api/v1/auth/signup", json=signup_payload)
        assert res.status_code == 400
        assert "Email already registered" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_signup_invalid_email_format():
    res = client.post("/api/v1/auth/signup", json={
        "full_name": "Bad Email",
        "email": "notanemail",
        "password": "password",
        "state_id": 1,
        "district_id": 1
    })
    assert res.status_code == 400
    assert "Invalid email address format" in res.json()["detail"]

def test_signup_database_error_sanitized():
    mock_db = MagicMock()
    mock_db.query.side_effect = Exception("Database connection failure")
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/v1/auth/signup", json={
            "full_name": "Test",
            "email": "test@example.com",
            "password": "password",
            "state_id": 1,
            "district_id": 1
        })
        assert res.status_code == 503
        assert "Database service temporarily unavailable" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_production_config_validation(monkeypatch):
    from app.core.config import Settings
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.delenv("POSTGRES_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SQLALCHEMY_DATABASE_URI", raising=False)
    cfg = Settings()
    with pytest.raises(ValueError, match="Production database is not configured"):
        cfg.validate_production_config()

