from datetime import datetime

from app import create_app
from extensions import db
from models import CalendarEvent, Enrollment, Grade, Role, Section, User


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


def test_admin_can_list_and_create_calendar_events():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        create_user("admin", "admin@example.com", "A-001")
        section = Section(
            name="Section A",
            grade_level="Grade 10",
            school_year="2026-2027",
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        db.session.add(
            CalendarEvent(
                title="Quarter Opening",
                section_id=section.id,
                start_at=datetime.fromisoformat("2026-06-01T08:00:00"),
                end_at=datetime.fromisoformat("2026-06-01T09:00:00"),
                event_type="school",
                description="Opening event",
            )
        )
        db.session.commit()
        section_id = section.id

    client = app.test_client()
    login_as(client, "admin@example.com")

    get_response = client.get("/api/admin/calendar")
    assert get_response.status_code == 200
    assert get_response.get_json()["events"][0]["title"] == "Quarter Opening"

    create_response = client.post(
        "/api/admin/calendar",
        json={
            "title": "Assessment Window",
            "section_id": section_id,
            "start_at": "2026-06-15T10:00:00",
            "end_at": "2026-06-15T12:00:00",
            "event_type": "assessment",
            "description": "Quarter assessment schedule",
        },
    )
    assert create_response.status_code == 201
    assert create_response.get_json()["event"]["title"] == "Assessment Window"
    event_id = create_response.get_json()["event"]["id"]

    update_response = client.put(
        f"/api/admin/calendar/{event_id}",
        json={
            "title": "Assessment Window Revised",
            "event_type": "section",
            "description": "Updated schedule",
        },
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["event"]["title"] == "Assessment Window Revised"


def test_admin_can_create_and_update_resources():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        create_user("admin", "admin@example.com", "A-001")
        section = Section(
            name="Section A",
            grade_level="Grade 10",
            school_year="2026-2027",
            status="active",
        )
        db.session.add(section)
        db.session.commit()
        section_id = section.id

    client = app.test_client()
    login_as(client, "admin@example.com")

    create_response = client.post(
        "/api/admin/resources",
        json={
            "section_id": section_id,
            "title": "School Handbook",
            "category": "PDF",
            "file_path": "resources/handbook.pdf",
            "visibility": "section",
        },
    )
    assert create_response.status_code == 201
    resource_id = create_response.get_json()["resource"]["id"]

    update_response = client.put(
        f"/api/admin/resources/{resource_id}",
        json={
            "title": "School Handbook Revised",
            "visibility": "school",
        },
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["resource"]["title"] == "School Handbook Revised"
    assert update_response.get_json()["resource"]["visibility"] == "school"


def test_admin_reports_summary_returns_enrollment_grade_and_intervention_counts():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        create_user("admin", "admin@example.com", "A-001")
        student = create_user("student", "student@example.com", "S-001")
        section = Section(
            name="Section A",
            grade_level="Grade 10",
            school_year="2026-2027",
            adviser_user_id=teacher.id,
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        db.session.add(
            Enrollment(section_id=section.id, student_user_id=student.id, status="active")
        )
        db.session.add(
            Grade(
                section_id=section.id,
                assignment_id=1,
                student_user_id=student.id,
                score=18,
                percentage=72,
                remarks="Needs support",
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "admin@example.com")

    response = client.get("/api/admin/reports")
    assert response.status_code == 200
    body = response.get_json()
    assert body["summary"]["total_enrollments"] == 1
    assert body["summary"]["section_count"] == 1
    assert body["summary"]["at_risk_grades"] == 1
