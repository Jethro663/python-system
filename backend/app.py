from pathlib import Path

from flask import Flask

from config import Config, load_environment
from extensions import db, login_manager, migrate
from models import User  # noqa: F401
from routes.admin import admin_bp
from routes.auth import auth_bp
from routes.student import student_bp
from routes.teacher import teacher_bp
from seed import seed_defaults


def _ensure_runtime_directories(app):
    for key in ("UPLOAD_ROOT", "MODULE_UPLOAD_DIR", "RESOURCE_UPLOAD_DIR", "ROSTER_UPLOAD_DIR", "EXPORT_DIR"):
        path = app.config.get(key)
        if path:
            app.logger.debug("Ensuring runtime directory %s=%s", key, path)
            Path(path).mkdir(parents=True, exist_ok=True)


def create_app(test_config=None):
    load_environment()
    app = Flask(__name__)
    app.config.from_mapping(Config.values())

    if test_config:
        app.config.update(test_config)

    _ensure_runtime_directories(app)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(teacher_bp, url_prefix="/api/teacher")
    app.register_blueprint(student_bp, url_prefix="/api/student")

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return {"message": "Authentication required."}, 401

    @app.shell_context_processor
    def make_shell_context():
        return {"db": db, "seed_defaults": seed_defaults}

    @app.cli.command("seed-defaults")
    def seed_defaults_command():
        seed_defaults()
        print("Seeded roles, system settings, demo accounts, and the demo class.")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
