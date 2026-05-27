from app import create_app
from extensions import db
from models import Resource, Role, Section, User


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


def test_admin_can_list_and_create_shared_resources():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        admin = create_user("admin", "admin@example.com", "A-001")
        section = Section(
            name="Section A",
            grade_level="Grade 10",
            school_year="2026-2027",
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        db.session.add(
            Resource(
                uploader_user_id=admin.id,
                section_id=None,
                title="School Handbook",
                category="pdf",
                file_path="/downloads/handbook.pdf",
                visibility="school",
            )
        )
        db.session.commit()
        section_id = section.id

    client = app.test_client()
    login_as(client, "admin@example.com")

    list_response = client.get("/api/admin/resources")
    assert list_response.status_code == 200
    assert list_response.get_json()["resources"][0]["title"] == "School Handbook"

    create_response = client.post(
        "/api/admin/resources",
        json={
            "title": "Grade 10 Reference Pack",
            "category": "reference",
            "file_path": "/downloads/reference-pack.pdf",
            "visibility": "section",
            "section_id": section_id,
        },
    )
    assert create_response.status_code == 201
    assert create_response.get_json()["resource"]["title"] == "Grade 10 Reference Pack"
