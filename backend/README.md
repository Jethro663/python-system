# Backend Setup

Run the following commands from the project root: `C:\Users\jethr\Desktop\InsaneProjects\Python System`

## Install dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## SQLite development

The backend uses SQLite by default. `backend/database.db` is the local development database, and the SQLAlchemy model layer plus migrations remain the schema source of truth.

Create the local database file and schema:

```powershell
.\.venv\Scripts\python.exe -c "from app import create_app; from bootstrap_db import create_schema; app=create_app(); ctx=app.app_context(); ctx.push(); create_schema(); ctx.pop()"
```

If you use `.env`, keep `DATABASE_URL=sqlite:///backend/database.db` or omit it entirely to use the same SQLite default from `backend/config.py`.

Bootstrap defaults are also environment-driven:

- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `UPLOAD_ROOT`

The app now loads `backend/.env` automatically at startup and creates these runtime directories if they do not exist:

- `backend/uploads/modules`
- `backend/uploads/resources`
- `backend/uploads/rosters`
- `backend/uploads/exports`

## MySQL development

MySQL remains the docx-aligned target database. Point `DATABASE_URL` at a local MySQL schema such as:

```powershell
DATABASE_URL=mysql+pymysql://root:password@localhost/python_system
```

Then run the migration path against that database:

```powershell
.\.venv\Scripts\flask.exe --app backend\app.py db upgrade -d backend\migrations
.\.venv\Scripts\flask.exe --app backend\app.py seed-defaults
```

## Initialize migrations

```powershell
.\.venv\Scripts\flask.exe --app backend\app.py db init -d backend\migrations
.\.venv\Scripts\flask.exe --app backend\app.py db migrate -d backend\migrations -m "initial schema"
.\.venv\Scripts\flask.exe --app backend\app.py db upgrade -d backend\migrations
```

## Test the backend foundation

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
```

## Seed baseline records

```powershell
.\.venv\Scripts\python.exe -c "from app import create_app; from seed import seed_defaults; app=create_app(); ctx=app.app_context(); ctx.push(); seed_defaults(); ctx.pop()"
```

Or use the Flask CLI command:

```powershell
.\.venv\Scripts\flask.exe --app backend\app.py seed-defaults
```
