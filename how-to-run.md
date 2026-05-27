# How to Run

This project has a Flask backend (`backend`) and a Vite React frontend (`frontend`).

## 1) Prerequisites

- Python 3.13+ available as `python`
- Node.js + npm (Windows path used in scripts: `C:\Program Files\nodejs\npm.cmd`)

## 2) Install Backend Dependencies

From project root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## 3) Initialize Database (SQLite default)

From project root:

```powershell
.\.venv\Scripts\python.exe -c "from app import create_app; from bootstrap_db import create_schema; app=create_app(); ctx=app.app_context(); ctx.push(); create_schema(); ctx.pop()"
.\.venv\Scripts\flask.exe --app backend\app.py seed-defaults
```

Notes:

- Default local DB path is `backend/database.db`.
- `backend/.env` is auto-loaded by the backend if present.

## 4) Install Frontend Dependencies

```powershell
cd frontend
npm install
cd ..
```

## 5) Run in Development

Option A (provided scripts):

```powershell
.\start-backend-dev.cmd
.\start-frontend-dev.cmd
```

Option B (manual terminals):

Terminal 1 (project root):

```powershell
.\.venv\Scripts\python.exe -m flask --app backend\app.py run --host 127.0.0.1 --port 5000
```

Terminal 2 (`frontend`):

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

## 6) Open the App

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:5000`

## 7) Run Tests

From project root:

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```
