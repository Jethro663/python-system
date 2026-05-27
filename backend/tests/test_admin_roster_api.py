import io

from app import create_app
from extensions import db
from models import Enrollment, Role, Section, User


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


def login_as(client, email):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Test@123"},
    )
    assert response.status_code == 200


def test_admin_can_list_users_and_sections():
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
        section = Section(
            name="Section A",
            grade_level="Grade 10",
            school_year="2026-2027",
            adviser_user_id=teacher.id,
            status="active",
        )
        db.session.add(section)
        db.session.commit()

    client = app.test_client()
    login_as(client, "admin@example.com")

    users_response = client.get("/api/admin/users")
    sections_response = client.get("/api/admin/sections")

    assert users_response.status_code == 200
    assert sections_response.status_code == 200
    assert len(users_response.get_json()["users"]) == 2
    assert sections_response.get_json()["sections"][0]["name"] == "Section A"


def test_admin_can_preview_and_commit_roster_csv():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
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

    csv_content = "\n".join(
        [
            "school_id,first_name,last_name,email,grade_level,guardian_name,guardian_contact",
            "S-001,Learner,One,student1@example.com,Grade 10,Guardian One,09123456789",
            "S-002,Learner,Two,student2@example.com,Grade 10,Guardian Two,09999999999",
        ]
    )

    preview = client.post(
        "/api/admin/rosters/preview",
        data={
            "section_id": str(section_id),
            "file": (io.BytesIO(csv_content.encode("utf-8")), "roster.csv"),
        },
        content_type="multipart/form-data",
    )

    assert preview.status_code == 200
    preview_body = preview.get_json()
    assert preview_body["summary"]["valid_rows"] == 2
    assert preview_body["summary"]["duplicate_rows"] == 0

    commit = client.post(
        "/api/admin/rosters/import",
        json={
            "section_id": section_id,
            "rows": preview_body["rows"],
        },
    )

    assert commit.status_code == 201
    assert commit.get_json()["summary"]["created_users"] == 2
    assert commit.get_json()["summary"]["created_enrollments"] == 2

    with app.app_context():
        assert User.query.filter(User.school_id.in_(["S-001", "S-002"])).count() == 2
        assert Enrollment.query.filter_by(section_id=section_id).count() == 2
