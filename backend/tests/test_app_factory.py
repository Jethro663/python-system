import os
from pathlib import Path

from app import create_app
from config import load_environment, normalize_database_url


def test_create_app_allows_test_database_override():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    assert app.config["TESTING"] is True
    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///:memory:"


def test_create_app_initializes_runtime_storage_directories(tmp_path):
    upload_root = tmp_path / "uploads"
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "UPLOAD_ROOT": str(upload_root),
            "MODULE_UPLOAD_DIR": str(upload_root / "modules"),
            "RESOURCE_UPLOAD_DIR": str(upload_root / "resources"),
            "ROSTER_UPLOAD_DIR": str(upload_root / "rosters"),
            "EXPORT_DIR": str(upload_root / "exports"),
        }
    )

    assert app.config["UPLOAD_ROOT"] == str(upload_root)
    assert (upload_root / "modules").is_dir()
    assert (upload_root / "resources").is_dir()
    assert (upload_root / "rosters").is_dir()
    assert (upload_root / "exports").is_dir()


def test_load_environment_reads_backend_env_file_without_overwriting_existing_values(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            (
                "SECRET_KEY=from-file",
                "DATABASE_URL=mysql+pymysql://demo:demo@localhost/python_system",
                "DEFAULT_ADMIN_EMAIL=loaded@example.com",
            )
        ),
        encoding="utf-8",
    )
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DEFAULT_ADMIN_EMAIL", raising=False)
    monkeypatch.setenv("SECRET_KEY", "from-env")

    load_environment(env_file)

    assert Path(env_file).exists()
    assert os.environ["SECRET_KEY"] == "from-env"
    assert os.environ["DATABASE_URL"] == "mysql+pymysql://demo:demo@localhost/python_system"
    assert os.environ["DEFAULT_ADMIN_EMAIL"] == "loaded@example.com"


def test_load_environment_uses_last_value_when_same_key_appears_twice(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            (
                "DATABASE_URL=mysql+pymysql://root:password@localhost/python_system",
                "DATABASE_URL=sqlite:///backend/database.db",
            )
        ),
        encoding="utf-8",
    )
    monkeypatch.delenv("DATABASE_URL", raising=False)

    load_environment(env_file)

    assert os.environ["DATABASE_URL"] == "sqlite:///backend/database.db"


def test_normalize_database_url_resolves_relative_backend_sqlite_path():
    normalized = normalize_database_url("sqlite:///backend/database.db")

    assert normalized.endswith("/backend/database.db")
    assert normalized.startswith("sqlite:///")
