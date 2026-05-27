from app import create_app
from extensions import db
from models import Enrollment, Grade, Intervention, Role, Section, SystemSetting, User
from seed import seed_system_settings


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


def test_admin_can_view_and_update_system_settings():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        create_user("admin", "admin@example.com", "A-001")
        seed_system_settings()

    client = app.test_client()
    login_as(client, "admin@example.com")

    get_response = client.get("/api/admin/system-settings")
    assert get_response.status_code == 200
    body = get_response.get_json()
    assert body["settings"]["mastery_threshold"] == "74"

    update_response = client.put(
        "/api/admin/system-settings",
        json={"mastery_threshold": "75", "active_quarter": "Q2"},
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["settings"]["mastery_threshold"] == "75"
    assert update_response.get_json()["settings"]["active_quarter"] == "Q2"

    with app.app_context():
        threshold = SystemSetting.query.filter_by(setting_key="mastery_threshold").first()
        assert threshold.setting_value == "75"


def test_admin_can_access_student_records_overview():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        create_user("admin", "admin@example.com", "A-001")
        teacher = create_user("teacher", "teacher@example.com", "T-001")
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
        db.session.flush()
        grade = Grade(
            section_id=section.id,
            assignment_id=1,
            student_user_id=student.id,
            score=21,
            percentage=84,
            remarks="Passing",
        )
        db.session.add(grade)
        db.session.commit()

    client = app.test_client()
    login_as(client, "admin@example.com")

    response = client.get("/api/admin/students")
    assert response.status_code == 200
    body = response.get_json()
    assert body["students"][0]["email"] == "student@example.com"
    assert body["students"][0]["current_section"] == "Section A"
    assert body["students"][0]["latest_percentage"] == 84.0


def test_admin_can_run_academic_transition_and_reset_open_interventions():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        create_user("admin", "admin@example.com", "A-001")
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        student = create_user("student", "student@example.com", "S-001")
        seed_system_settings()
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
            Intervention(
                student_user_id=student.id,
                section_id=section.id,
                assignment_id=1,
                trigger_score=60,
                status="open",
                teacher_note="Needs remediation",
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "admin@example.com")

    response = client.post(
        "/api/admin/academic-transition",
        json={"next_quarter": "Q2", "next_school_year": "2026-2027"},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["settings"]["active_quarter"] == "Q2"
    assert body["summary"]["archived_quarter"] == "Q1"
    assert body["summary"]["reset_interventions"] == 1

    with app.app_context():
        intervention = Intervention.query.first()
        assert intervention.status == "closed"
        assert intervention.resolved_at is not None
