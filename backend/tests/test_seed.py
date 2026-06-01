from app import create_app
from extensions import db
from models import (
    Assignment,
    AssignmentQuestion,
    Enrollment,
    Module,
    Role,
    Section,
    SectionTeacher,
    StudentProfile,
    SystemSetting,
    TeacherProfile,
    User,
)
from seed import (
    seed_admin_user,
    seed_demo_class,
    seed_demo_users,
    seed_roles,
    seed_system_settings,
)


def test_seed_roles_inserts_required_role_catalog():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        seed_roles()

        assert {role.name for role in Role.query.order_by(Role.name).all()} == {
            "admin",
            "student",
            "teacher",
        }


def test_seed_system_settings_inserts_default_platform_values():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        seed_system_settings()

        settings = {
            item.setting_key: item.setting_value
            for item in SystemSetting.query.order_by(SystemSetting.setting_key).all()
        }

        assert settings == {
            "active_quarter": "Q1",
            "active_school_year": "2026-2027",
            "mastery_threshold": "74",
            "upload_limit_mb": "25",
        }


def test_seed_admin_user_creates_bootstrap_admin_account():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "DEFAULT_ADMIN_EMAIL": "bootstrap-admin@example.com",
            "DEFAULT_ADMIN_PASSWORD": "Admin123!",
        }
    )

    with app.app_context():
        db.create_all()
        seed_roles()
        seed_admin_user()

        admin_user = User.query.filter_by(email="bootstrap-admin@example.com").first()
        assert admin_user is not None
        assert admin_user.role.name == "admin"
        assert admin_user.check_password("Admin123!")


def test_seed_demo_users_creates_login_page_quick_access_accounts():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        seed_roles()
        seed_demo_users()

        teacher = User.query.filter_by(email="teacher.demo@nexora.local").first()
        student = User.query.filter_by(email="student.demo@nexora.local").first()

        assert teacher is not None
        assert teacher.role.name == "teacher"
        assert teacher.check_password("Teacher123!")
        assert TeacherProfile.query.filter_by(user_id=teacher.id).first() is not None

        assert student is not None
        assert student.role.name == "student"
        assert student.check_password("Student123!")
        assert StudentProfile.query.filter_by(user_id=student.id).first() is not None


def test_seed_demo_class_creates_student_workspace_content():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        seed_roles()
        seed_demo_users()
        section = seed_demo_class()

        teacher = User.query.filter_by(email="teacher.demo@nexora.local").first()
        student = User.query.filter_by(email="student.demo@nexora.local").first()
        assignment = Assignment.query.filter_by(
            section_id=section.id,
            title="Algebra Readiness Check",
        ).first()

        assert Section.query.filter_by(name="Demo Mathematics 10").first() is not None
        assert SectionTeacher.query.filter_by(
            section_id=section.id,
            teacher_user_id=teacher.id,
            subject_name="Mathematics",
        ).first() is not None
        assert Enrollment.query.filter_by(
            section_id=section.id,
            student_user_id=student.id,
            status="active",
        ).first() is not None
        assert Module.query.filter_by(section_id=section.id, title="Algebra Foundations").first() is not None
        assert assignment is not None
        assert assignment.status == "published"
        assert AssignmentQuestion.query.filter_by(assignment_id=assignment.id).count() == 2
