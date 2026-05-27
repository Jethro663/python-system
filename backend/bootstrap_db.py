from extensions import db
import models  # noqa: F401


def create_schema():
    db.create_all()


if __name__ == "__main__":
    from app import create_app

    app = create_app()
    with app.app_context():
        create_schema()
