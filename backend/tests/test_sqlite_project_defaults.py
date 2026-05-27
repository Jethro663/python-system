from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_env_example_documents_mysql_with_sqlite_fallback():
    env_example = (BACKEND_DIR / ".env.example").read_text(encoding="utf-8")

    assert "mysql+pymysql" in env_example.lower()
    assert "sqlite" in env_example.lower()


def test_requirements_include_mysql_driver():
    requirements = (BACKEND_DIR / "requirements.txt").read_text(encoding="utf-8")

    assert "pymysql" in requirements.lower()
