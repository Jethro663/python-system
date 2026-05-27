from app import create_app
from extensions import db
from models import Role, User


def create_user(email="admin@example.com", password_hash="hashed", role_name="admin"):
    role = Role.query.filter_by(name=role_name).first()
    if not role:
        role = Role(name=role_name)
        db.session.add(role)
        db.session.flush()

    user = User(
        school_id=f"{role_name}-001",
        role_id=role.id,
        first_name="Admin",
        last_name="User",
        email=email,
        password_hash=password_hash,
        status="active",
    )
    db.session.add(user)
    db.session.commit()
    return user


def test_login_returns_current_user_payload_and_sets_session():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        create_user(password_hash="Test@123")

    client = app.test_client()
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "Test@123"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["user"]["email"] == "admin@example.com"
    assert body["user"]["role"] == "admin"

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.get_json()["authenticated"] is True
    assert me.get_json()["user"]["email"] == "admin@example.com"


def test_login_rejects_invalid_credentials():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        create_user(password_hash="Test@123")

    client = app.test_client()
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.get_json()["message"] == "Invalid credentials."
