from app import create_app
from extensions import db
from models import Role, SystemSetting, User
from seed import seed_admin_user, seed_roles, seed_system_settings


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
