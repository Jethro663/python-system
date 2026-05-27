@echo off
cd /d "C:\Users\jethr\Desktop\InsaneProjects\Python System\frontend"
del /q frontend-dev.out.log frontend-dev.err.log 2>nul
start "" /b cmd /c ""C:\Program Files\nodejs\npm.cmd" run dev -- --host 127.0.0.1 --port 5173 1>frontend-dev.out.log 2>frontend-dev.err.log"
