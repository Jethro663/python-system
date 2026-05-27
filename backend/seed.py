from flask import current_app

from extensions import db
from models import Role, SystemSetting, User


def seed_roles():
    for name in ("admin", "teacher", "student"):
        exists = Role.query.filter_by(name=name).first()
        if not exists:
            db.session.add(Role(name=name))

    db.session.commit()


def seed_system_settings():
    defaults = {
        "active_school_year": "2026-2027",
        "active_quarter": "Q1",
        "mastery_threshold": "74",
        "upload_limit_mb": "25",
    }

    for setting_key, setting_value in defaults.items():
        existing = SystemSetting.query.filter_by(setting_key=setting_key).first()
        if not existing:
            db.session.add(
                SystemSetting(setting_key=setting_key, setting_value=setting_value)
            )

    db.session.commit()


def seed_admin_user():
    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        admin_role = Role(name="admin")
        db.session.add(admin_role)
        db.session.flush()

    email = current_app.config["DEFAULT_ADMIN_EMAIL"].strip().lower()
    password = current_app.config["DEFAULT_ADMIN_PASSWORD"]

    existing = User.query.filter_by(email=email).first()
    if existing:
        return existing

    admin_user = User(
        school_id="ADMIN-001",
        role_id=admin_role.id,
        first_name="System",
        last_name="Administrator",
        email=email,
        status="active",
        password_hash="",
    )
    admin_user.set_password(password)
    db.session.add(admin_user)
    db.session.commit()
    return admin_user


def seed_defaults():
    seed_roles()
    seed_system_settings()
    seed_admin_user()
