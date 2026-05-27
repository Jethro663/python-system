import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SQLITE_PATH = BASE_DIR / "database.db"
DEFAULT_UPLOAD_ROOT = BASE_DIR / "uploads"


def _parse_env_value(value):
    cleaned = value.strip()
    if cleaned.startswith(("'", '"')) and cleaned.endswith(("'", '"')):
        return cleaned[1:-1]
    return cleaned


def load_environment(env_path=None):
    target = Path(env_path) if env_path else BASE_DIR / ".env"
    if not target.exists():
        return

    parsed = {}
    for raw_line in target.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        parsed[key.strip()] = _parse_env_value(value)

    for key, value in parsed.items():
        os.environ.setdefault(key, value)


def normalize_database_url(raw_url):
    if not raw_url.startswith("sqlite:///"):
        return raw_url

    sqlite_path = raw_url.removeprefix("sqlite:///")
    candidate = Path(sqlite_path)
    if candidate.is_absolute():
        return raw_url

    roots = []
    if candidate.parts and candidate.parts[0].lower() == "backend":
        roots.append(BASE_DIR.parent)
    roots.append(BASE_DIR)

    for root in roots:
        resolved = (root / candidate).resolve()
        return f"sqlite:///{resolved.as_posix()}"

    return raw_url


class Config:
    @classmethod
    def values(cls):
        upload_root = Path(os.getenv("UPLOAD_ROOT", DEFAULT_UPLOAD_ROOT.as_posix()))
        return {
            "SECRET_KEY": os.getenv("SECRET_KEY", "dev-secret-key"),
            "SQLALCHEMY_TRACK_MODIFICATIONS": False,
            "DEFAULT_ADMIN_EMAIL": os.getenv("DEFAULT_ADMIN_EMAIL", "admin@nexora.local"),
            "DEFAULT_ADMIN_PASSWORD": os.getenv("DEFAULT_ADMIN_PASSWORD", "Admin123!"),
            "SQLALCHEMY_DATABASE_URI": normalize_database_url(
                os.getenv(
                    "DATABASE_URL",
                    f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}",
                )
            ),
            "UPLOAD_ROOT": str(upload_root),
            "MODULE_UPLOAD_DIR": str(upload_root / "modules"),
            "RESOURCE_UPLOAD_DIR": str(upload_root / "resources"),
            "ROSTER_UPLOAD_DIR": str(upload_root / "rosters"),
            "EXPORT_DIR": str(upload_root / "exports"),
        }
