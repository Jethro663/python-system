from io import BytesIO
from tempfile import TemporaryDirectory

from app import create_app
from extensions import db
from models import AuditLog, Role, Section, SectionTeacher, StudentProfile, TeacherProfile, User


def create_user(role_name, email, school_id):
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
        password_hash="Test@123",
        status="active",
    )
    db.session.add(user)
    db.session.commit()
    return user


def login_as(client, email):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Test@123"},
    )
    assert response.status_code == 200


def test_admin_dashboard_requires_admin_role():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        create_user("teacher", "teacher@example.com", "T-001")

    client = app.test_client()
    login_as(client, "teacher@example.com")

    response = client.get("/api/admin/dashboard")
    assert response.status_code == 403
    assert response.get_json()["message"] == "You do not have access to this resource."


def test_admin_can_create_user_and_section_records():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        create_user("admin", "admin@example.com", "A-001")
        create_user("teacher", "adviser@example.com", "T-001")
        create_user("teacher", "science@example.com", "T-002")

    client = app.test_client()
    login_as(client, "admin@example.com")

    create_user_response = client.post(
        "/api/admin/users",
        json={
            "role": "student",
            "school_id": "S-001",
            "first_name": "Learner",
            "last_name": "One",
            "email": "student@example.com",
            "password": "Student123!",
            "status": "active",
            "grade_level": "Grade 10",
            "guardian_name": "Guardian One",
            "guardian_contact": "09123456789",
        },
    )

    assert create_user_response.status_code == 201
    created_user = create_user_response.get_json()["user"]
    assert created_user["role"] == "student"
    assert created_user["school_id"] == "S-001"

    create_section_response = client.post(
        "/api/admin/sections",
        json={
            "name": "Section A",
            "grade_level": "Grade 10",
            "school_year": "2026-2027",
            "schedule_text": "MWF 08:00-09:00",
            "adviser_user_id": 2,
            "teacher_assignments": [
                {"teacher_user_id": 2, "subject_name": "Mathematics"},
                {"teacher_user_id": 3, "subject_name": "Science"},
            ],
        },
    )

    assert create_section_response.status_code == 201
    created_section = create_section_response.get_json()["section"]
    assert created_section["name"] == "Section A"
    assert created_section["schedule_text"] == "MWF 08:00-09:00"
    assert len(created_section["teacher_assignments"]) == 2
    assert created_section["teacher_assignments"][0]["subject_name"] == "Mathematics"
    assert created_section["teacher_assignments"][1]["subject_name"] == "Science"

    with app.app_context():
        assert User.query.filter_by(email="student@example.com").count() == 1
        assert Section.query.filter_by(name="Section A").count() == 1
        assert SectionTeacher.query.count() == 2


def test_admin_can_update_users_status_and_password():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        create_user("admin", "admin@example.com", "A-001")
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        db.session.add(TeacherProfile(user_id=teacher.id, department="Math", phone="0900"))
        student = create_user("student", "student@example.com", "S-001")
        student_id = student.id
        db.session.add(
            StudentProfile(
                user_id=student.id,
                grade_level="Grade 10",
                guardian_name="Old Guardian",
                guardian_contact="0912",
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "admin@example.com")

    update_response = client.put(
        f"/api/admin/users/{student_id}",
        json={
            "first_name": "Updated",
            "last_name": "Student",
            "email": "updated.student@example.com",
            "school_id": "S-101",
            "grade_level": "Grade 11",
            "guardian_name": "New Guardian",
            "guardian_contact": "0999",
        },
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["user"]["full_name"] == "Updated Student"

    status_response = client.post(
        f"/api/admin/users/{student_id}/status",
        json={"status": "suspended"},
    )
    assert status_response.status_code == 200
    assert status_response.get_json()["user"]["status"] == "suspended"

    reset_response = client.post(
        f"/api/admin/users/{student_id}/reset-password",
        json={"password": "Reset123!"},
    )
    assert reset_response.status_code == 200

    with app.app_context():
        refreshed_student = db.session.get(User, student_id)
        assert refreshed_student.email == "updated.student@example.com"
        assert refreshed_student.school_id == "S-101"
        assert refreshed_student.status == "suspended"
        assert refreshed_student.check_password("Reset123!")
        student_profile = StudentProfile.query.filter_by(user_id=student_id).first()
        assert student_profile.grade_level == "Grade 11"
        assert student_profile.guardian_name == "New Guardian"
        assert student_profile.guardian_contact == "0999"
        assert AuditLog.query.filter_by(action="admin.user.update", entity_id=student_id).count() == 1
        assert AuditLog.query.filter_by(action="admin.user.status", entity_id=student_id).count() == 1
        assert (
            AuditLog.query.filter_by(action="admin.user.reset_password", entity_id=student_id).count()
            == 1
        )


def test_admin_can_delete_archived_user_only():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        admin = create_user("admin", "admin@example.com", "A-001")
        student = create_user("student", "student.delete@example.com", "S-DELETE")
        admin_id = admin.id
        student_id = student.id

    client = app.test_client()
    login_as(client, "admin@example.com")

    active_delete_response = client.delete(f"/api/admin/users/{student_id}")
    assert active_delete_response.status_code == 400
    assert active_delete_response.get_json()["message"] == "Archive the user before deleting them."

    self_delete_response = client.delete(f"/api/admin/users/{admin_id}")
    assert self_delete_response.status_code == 400
    assert self_delete_response.get_json()["message"] == "You cannot delete your own account."

    archive_response = client.post(
        f"/api/admin/users/{student_id}/status",
        json={"status": "inactive"},
    )
    assert archive_response.status_code == 200

    delete_response = client.delete(f"/api/admin/users/{student_id}")
    assert delete_response.status_code == 200
    assert delete_response.get_json()["message"] == "User deleted."

    with app.app_context():
        assert db.session.get(User, student_id) is None
        assert AuditLog.query.filter_by(action="admin.user.delete", entity_id=student_id).count() == 1


def test_admin_can_update_and_archive_sections():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        create_user("admin", "admin@example.com", "A-001")
        adviser = create_user("teacher", "adviser@example.com", "T-001")
        other_teacher = create_user("teacher", "science@example.com", "T-002")
        section = Section(
            name="Section A",
            grade_level="Grade 10",
            school_year="2026-2027",
            adviser_user_id=adviser.id,
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        section_id = section.id
        other_teacher_id = other_teacher.id
        db.session.add(
            SectionTeacher(
                section_id=section.id,
                teacher_user_id=adviser.id,
                subject_name="Mathematics",
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "admin@example.com")

    response = client.put(
        f"/api/admin/sections/{section_id}",
        json={
            "name": "Section A Prime",
            "grade_level": "Grade 11",
            "school_year": "2027-2028",
            "schedule_text": "TTH 10:00-11:30",
            "adviser_user_id": other_teacher_id,
            "status": "archived",
            "teacher_assignments": [
                {
                    "teacher_user_id": other_teacher_id,
                    "subject_name": "Science",
                }
            ],
        },
    )

    assert response.status_code == 200
    section_payload = response.get_json()["section"]
    assert section_payload["name"] == "Section A Prime"
    assert section_payload["schedule_text"] == "TTH 10:00-11:30"
    assert section_payload["status"] == "archived"
    assert section_payload["teacher_assignments"][0]["subject_name"] == "Science"

    with app.app_context():
        refreshed_section = db.session.get(Section, section_id)
        assert refreshed_section.name == "Section A Prime"
        assert refreshed_section.grade_level == "Grade 11"
        assert refreshed_section.school_year == "2027-2028"
        assert refreshed_section.schedule_text == "TTH 10:00-11:30"
        assert refreshed_section.status == "archived"
        assert refreshed_section.adviser_user_id == other_teacher_id
        assignments = SectionTeacher.query.filter_by(section_id=section_id).all()
        assert len(assignments) == 1
        assert assignments[0].subject_name == "Science"
        assert AuditLog.query.filter_by(action="admin.section.update", entity_id=section_id).count() == 1


def test_admin_can_filter_users_by_role_status_and_query():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        create_user("admin", "admin@example.com", "A-001")
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        student = create_user("student", "learner@example.com", "S-001")
        student.status = "suspended"
        db.session.commit()

    client = app.test_client()
    login_as(client, "admin@example.com")

    teacher_only = client.get("/api/admin/users?role=teacher")
    assert teacher_only.status_code == 200
    assert len(teacher_only.get_json()["users"]) == 1
    assert teacher_only.get_json()["users"][0]["email"] == "teacher@example.com"

    suspended_only = client.get("/api/admin/users?status=suspended")
    assert suspended_only.status_code == 200
    assert len(suspended_only.get_json()["users"]) == 1
    assert suspended_only.get_json()["users"][0]["email"] == "learner@example.com"

    search_response = client.get("/api/admin/users?q=T-001")
    assert search_response.status_code == 200
    assert len(search_response.get_json()["users"]) == 1
    assert search_response.get_json()["users"][0]["school_id"] == "T-001"


def test_admin_can_upload_resource_files():
    with TemporaryDirectory() as tmp_dir:
        app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                "RESOURCE_UPLOAD_DIR": tmp_dir,
                "UPLOAD_ROOT": tmp_dir,
            }
        )

        with app.app_context():
            db.create_all()
            create_user("admin", "admin@example.com", "A-001")

        client = app.test_client()
        login_as(client, "admin@example.com")

        response = client.post(
            "/api/admin/uploads",
            data={
                "kind": "resource",
                "file": (BytesIO(b"resource file"), "handbook.pdf"),
            },
            content_type="multipart/form-data",
        )

        assert response.status_code == 201
        assert response.get_json()["file_path"].endswith("handbook.pdf")
