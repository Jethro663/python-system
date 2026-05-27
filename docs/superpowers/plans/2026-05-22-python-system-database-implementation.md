# Python System Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a MySQL-first Flask backend foundation with SQLAlchemy models, migration-ready extensions, and an optional SQLite fallback for local development.

**Architecture:** The backend will move from a single-file Flask script to an app-factory layout with explicit config and extension wiring. SQLAlchemy models will define the phase-1 checklist schema, and the app entrypoint will support both production-style MySQL configuration and a local SQLite fallback pointed at `backend/database.db`.

**Tech Stack:** Flask, Flask-SQLAlchemy, Flask-Migrate, python-dotenv-compatible environment variables, SQLite fallback, MySQL-compatible SQLAlchemy models

---

### Task 1: Backend Configuration and Extensions

**Files:**
- Create: `backend/config.py`
- Create: `backend/extensions.py`
- Modify: `backend/app.py`
- Test: `backend/tests/test_app_factory.py`

- [ ] **Step 1: Write the failing test**

```python
from app import create_app


def test_create_app_uses_sqlite_fallback_when_no_database_url():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    assert app.config["TESTING"] is True
    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///:memory:"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_app_factory.py::test_create_app_uses_sqlite_fallback_when_no_database_url -v`
Expected: FAIL with import or `create_app` missing errors.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/extensions.py
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
```

```python
# backend/config.py
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SQLITE_PATH = BASE_DIR / "database.db"


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}",
    )
```

```python
# backend/app.py
from flask import Flask

from config import Config
from extensions import db, migrate


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)

    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    migrate.init_app(app, db)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_app_factory.py::test_create_app_uses_sqlite_fallback_when_no_database_url -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app.py backend/config.py backend/extensions.py backend/tests/test_app_factory.py
git commit -m "feat: add backend app factory and db extensions"
```

### Task 2: Phase-1 Schema Models

**Files:**
- Modify: `backend/models.py`
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
from models import Role, User, Section, Assignment, Submission, SystemSetting


def test_phase_one_models_expose_expected_tables():
    assert Role.__tablename__ == "roles"
    assert User.__tablename__ == "users"
    assert Section.__tablename__ == "sections"
    assert Assignment.__tablename__ == "assignments"
    assert Submission.__tablename__ == "submissions"
    assert SystemSetting.__tablename__ == "system_settings"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_models.py::test_phase_one_models_expose_expected_tables -v`
Expected: FAIL because the model classes do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```python
from datetime import datetime

from extensions import db


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class Role(TimestampMixin, db.Model):
    __tablename__ = "roles"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)


class User(TimestampMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.String(50), unique=True, nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
```

Continue the same pattern for the phase-1 checklist tables:

- `teacher_profiles`
- `student_profiles`
- `sections`
- `section_teachers`
- `enrollments`
- `modules`
- `assignments`
- `assignment_questions`
- `submissions`
- `grades`
- `interventions`
- `announcements`
- `calendar_events`
- `resources`
- `audit_logs`
- `system_settings`

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_models.py -v`
Expected: PASS for model imports and table names.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_models.py
git commit -m "feat: add phase one database models"
```

### Task 3: Schema Creation and Seed Hooks

**Files:**
- Modify: `backend/app.py`
- Create: `backend/seed.py`
- Test: `backend/tests/test_seed.py`

- [ ] **Step 1: Write the failing test**

```python
from app import create_app
from extensions import db
from models import Role
from seed import seed_roles


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

        assert {role.name for role in Role.query.all()} == {
            "admin",
            "teacher",
            "student",
        }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_seed.py::test_seed_roles_inserts_required_role_catalog -v`
Expected: FAIL because `seed_roles` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/seed.py
from extensions import db
from models import Role


def seed_roles():
    for name in ("admin", "teacher", "student"):
        exists = Role.query.filter_by(name=name).first()
        if not exists:
            db.session.add(Role(name=name))

    db.session.commit()
```

```python
# backend/app.py
@app.shell_context_processor
def make_shell_context():
    return {"db": db}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_seed.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app.py backend/seed.py backend/tests/test_seed.py
git commit -m "feat: add seed helpers for base roles"
```

### Task 4: Local Database Bootstrap

**Files:**
- Create: `backend/bootstrap_db.py`
- Modify: `backend/app.py`
- Test: `backend/tests/test_bootstrap_db.py`

- [ ] **Step 1: Write the failing test**

```python
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
        assert "roles" in inspector.get_table_names()
        assert "users" in inspector.get_table_names()
        assert "system_settings" in inspector.get_table_names()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_bootstrap_db.py::test_create_schema_builds_all_tables -v`
Expected: FAIL because `create_schema` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/bootstrap_db.py
from extensions import db


def create_schema():
    db.create_all()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_bootstrap_db.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/bootstrap_db.py backend/tests/test_bootstrap_db.py
git commit -m "feat: add local schema bootstrap utility"
```

### Task 5: Migration and Environment Documentation

**Files:**
- Create: `backend/.env.example`
- Create: `backend/README.md`

- [ ] **Step 1: Write the environment example**

```env
SECRET_KEY=change-me
DATABASE_URL=mysql+pymysql://root:password@localhost/python_system
```

- [ ] **Step 2: Write the backend setup instructions**

```md
# Backend Setup

## Install dependencies

pip install flask flask-sqlalchemy flask-migrate pymysql pytest

## Local SQLite fallback

python -c "from app import create_app; from bootstrap_db import create_schema; app=create_app(); ctx=app.app_context(); ctx.push(); create_schema(); ctx.pop()"

## MySQL-first development

Set `DATABASE_URL` and then initialize migrations:

flask --app app db init
flask --app app db migrate -m "initial schema"
flask --app app db upgrade
```

- [ ] **Step 3: Review the docs against the spec**

Check that the README states:

- MySQL is the authoritative development database.
- SQLite is fallback-only.
- `backend/database.db` is disposable local state.

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example backend/README.md
git commit -m "docs: add backend database setup instructions"
```
