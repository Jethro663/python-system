Set shell = CreateObject("WScript.Shell")
command = "cmd /c cd /d ""C:\Users\jethr\Desktop\InsaneProjects\Python System\frontend"" && node_modules\.bin\vite.cmd --host 127.0.0.1 --port 5173 1>frontend-dev.out.log 2>frontend-dev.err.log"
shell.Run command, 0, False
