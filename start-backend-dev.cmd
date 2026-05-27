@echo off
cd /d "C:\Users\jethr\Desktop\InsaneProjects\Python System"
del /q backend-dev.out.log backend-dev.err.log 2>nul
start "" /b cmd /c ".\.venv\Scripts\python.exe -m flask --app backend\app.py run --host 127.0.0.1 --port 5000 1>backend-dev.out.log 2>backend-dev.err.log"
