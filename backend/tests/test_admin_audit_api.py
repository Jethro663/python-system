from app import create_app
from extensions import db
from models import AuditLog, Intervention, Role, User


def create_user(role_name, email, school_id, password="Test@123"):
    role = Role.query.filter_by(name=role_name).first()
    if not role:
        role = Role(name=role_name)
        db.session.add(role)
        db.session.flush()

    user = User(
        school_id=school_id,
        role_id=role.id,
        first_name=role_name.title(),
        last_name="User",
        email=email,
        password_hash=password,
        status="active",
    )
    db.session.add(user)
    db.session.commit()
    return user


def login_as(client, email, password="Test@123"):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200


def test_login_creates_audit_log_entry():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        user = create_user("admin", "admin@example.com", "A-001")
        user_id = user.id

    client = app.test_client()
    login_as(client, "admin@example.com")

    with app.app_context():
        log = AuditLog.query.filter_by(user_id=user_id, action="auth.login").first()
        assert log is not None
        assert log.entity_type == "user"


def test_admin_can_list_recent_audit_trail_entries():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        admin = create_user("admin", "admin@example.com", "A-001")
        db.session.add(
            AuditLog(
                user_id=admin.id,
                action="admin.user.create",
                entity_type="user",
                entity_id=99,
                meta_json={"email": "student@example.com"},
            )
        )
        db.session.add(
            AuditLog(
                user_id=admin.id,
                action="admin.settings.update",
                entity_type="system_setting",
                entity_id=None,
                meta_json={"mastery_threshold": "75"},
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "admin@example.com")

    response = client.get("/api/admin/audit")
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["entries"]) == 3
    assert body["entries"][0]["action"] in {
        "auth.login",
        "admin.user.create",
        "admin.settings.update",
    }


def test_admin_dashboard_and_profile_management_workflows():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        admin = create_user("admin", "admin@example.com", "A-001")
        db.session.add(
            Intervention(
                student_user_id=admin.id,
                section_id=1,
                assignment_id=1,
                trigger_score=50,
                status="open",
                teacher_note="placeholder",
            )
        )
        db.session.add(
            AuditLog(
                user_id=admin.id,
                action="admin.resource.create",
                entity_type="resource",
                entity_id=10,
                meta_json={"title": "Handbook"},
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "admin@example.com")

    dashboard_response = client.get("/api/admin/dashboard")
    assert dashboard_response.status_code == 200
    dashboard_body = dashboard_response.get_json()
    assert dashboard_body["totals"]["active_interventions"] == 1
    assert dashboard_body["totals"]["pending_imports"] == 0
    assert len(dashboard_body["recent_activity"]) >= 1

    profile_response = client.get("/api/admin/profile")
    assert profile_response.status_code == 200
    assert profile_response.get_json()["profile"]["email"] == "admin@example.com"

    update_response = client.put(
        "/api/admin/profile",
        json={
            "first_name": "Lead",
            "last_name": "Admin",
            "school_id": "ADMIN-101",
            "email": "lead.admin@example.com",
        },
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["profile"]["full_name"] == "Lead Admin"

    password_response = client.post(
        "/api/admin/profile/password",
        json={
            "current_password": "Test@123",
            "new_password": "Admin456!",
        },
    )
    assert password_response.status_code == 200
    assert password_response.get_json()["message"] == "Password updated."

    with app.app_context():
        admin = User.query.filter_by(email="lead.admin@example.com").first()
        assert admin is not None
        assert admin.school_id == "ADMIN-101"
        assert admin.check_password("Admin456!")
        assert AuditLog.query.filter_by(action="admin.profile.update", user_id=admin.id).count() == 1
        assert (
            AuditLog.query.filter_by(
                action="admin.profile.change_password",
                user_id=admin.id,
            ).count()
            == 1
        )
