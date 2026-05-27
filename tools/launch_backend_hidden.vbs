Set shell = CreateObject("WScript.Shell")
command = "cmd /c cd /d ""C:\Users\jethr\Desktop\InsaneProjects\Python System"" && .\.venv\Scripts\python.exe -m flask --app backend\app.py run --host 127.0.0.1 --port 5000 1>backend-dev.out.log 2>backend-dev.err.log"
shell.Run command, 0, False
