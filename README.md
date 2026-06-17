# Nexora LMS

A full-stack Learning Management System built with Python Flask and React, designed for school administration, teaching, and student workflows.

## Tech Stack

**Backend**
- Python 3.13+ / Flask
- SQLAlchemy ORM with Flask-Migrate (Alembic)
- Flask-Login for session-based authentication
- SQLite (default) or MySQL via PyMySQL

**Frontend**
- React 18 / Vite
- React Router v6
- Lucide React icons

## Features

**Admin Portal**
- Dashboard with school-wide overview
- User management (create, edit, deactivate accounts)
- Section and class management
- Student enrollment and roster import (CSV)
- Calendar and event management
- Resource library
- Audit log viewer
- System settings and school profile
- Reports and data export

**Teacher Portal**
- Home dashboard
- Class workspace (manage modules, assignments, discussions)
- Roster and gradebook
- Student performance tracking
- Assignment creation with multiple question types
- Submission grading with feedback
- Resource uploads and sharing
- Calendar and announcements
- Reports

**Student Portal**
- Home dashboard
- Class list and workspace
- View and submit assignments
- Grades and results
- Profile management

**Shared**
- Role-based access control (admin, teacher, student)
- Discussion threads and replies per section
- Calendar events with section scoping
- Announcement system
- Intervention tracking for at-risk students
- Audit logging

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js + npm

### Backend Setup

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or: .venv\Scripts\activate  # Windows

pip install -r backend/requirements.txt
```

Create `backend/.env` from the example:

```bash
cp backend/.env.example backend/.env
# Edit .env with your database credentials
```

Initialize the database and seed default data:

```bash
python -c "from backend.app import create_app; from backend.bootstrap_db import create_schema; app=create_app(); ctx=app.app_context(); ctx.push(); create_schema(); ctx.pop()"
flask --app backend/app.py seed-defaults
```

### Frontend Setup

```bash
cd frontend
npm install
```

### Running in Development

Start the backend (terminal 1):

```bash
flask --app backend/app.py run --host 127.0.0.1 --port 5000
```

Start the frontend (terminal 2):

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

- Frontend: http://127.0.0.1:5173
- Backend API: http://127.0.0.1:5000

### Running Tests

```bash
python -m pytest backend/tests -q
```

## Project Structure

```
python-system/
  backend/
    app.py            # Flask application factory
    config.py         # Configuration and environment loading
    models.py         # SQLAlchemy models
    extensions.py     # Flask extensions (db, login_manager, migrate)
    seed.py           # Default data seeder
    bootstrap_db.py   # Schema creation helper
    routes/           # Blueprint modules (auth, admin, teacher, student)
    services/         # Business logic layer
    tests/            # Pytest test suite
    migrations/       # Alembic migration scripts
  frontend/
    src/
      App.jsx         # Route definitions and role-based guards
      pages/          # Page components (admin, teacher, student views)
      components/     # Shared UI components
      context/        # React context providers (auth)
      lib/            # API client utilities
```

## Default Admin Credentials

| Field    | Value              |
|----------|--------------------|
| Email    | admin@nexora.local |
| Password | Admin123!          |

Change these in `backend/.env` before deploying.
