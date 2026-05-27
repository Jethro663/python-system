from app import create_app
from bootstrap_db import create_schema
from extensions import db


def test_create_schema_builds_all_tables():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        create_schema()
        inspector = db.inspect(db.engine)
        table_names = set(inspector.get_table_names())

        assert "roles" in table_names
        assert "users" in table_names
        assert "system_settings" in table_names
