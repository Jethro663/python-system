from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path


DETACHED_FLAGS = 0x00000010 | 0x00000200 | 0x01000000


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT
FRONTEND = ROOT / "frontend"
PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"
NPM = Path(r"C:\Program Files\nodejs\npm.cmd")
VITE = FRONTEND / "node_modules" / ".bin" / "vite.cmd"
BACKEND_OUT = ROOT / "backend-dev.out.log"
BACKEND_ERR = ROOT / "backend-dev.err.log"
FRONTEND_OUT = FRONTEND / "frontend-dev.out.log"
FRONTEND_ERR = FRONTEND / "frontend-dev.err.log"


def launch(command: list[str], cwd: Path, stdout_path: Path, stderr_path: Path) -> subprocess.Popen[str]:
    stdout_path.write_text("", encoding="utf-8")
    stderr_path.write_text("", encoding="utf-8")
    stdout_handle = stdout_path.open("a", encoding="utf-8")
    stderr_handle = stderr_path.open("a", encoding="utf-8")
    return subprocess.Popen(
        command,
        cwd=str(cwd),
        stdout=stdout_handle,
        stderr=stderr_handle,
        stdin=subprocess.DEVNULL,
        creationflags=DETACHED_FLAGS,
        close_fds=True,
    )


def probe(host: str, port: int, attempts: int = 40, delay: float = 0.25) -> bool:
    import socket

    for _ in range(attempts):
        sock = socket.socket()
        sock.settimeout(delay)
        try:
            sock.connect((host, port))
            return True
        except OSError:
            time.sleep(delay)
        finally:
            sock.close()
    return False


def main() -> int:
    backend = launch(
        [str(PYTHON), "-m", "flask", "--app", "backend\\app.py", "run", "--host", "127.0.0.1", "--port", "5000"],
        BACKEND,
        BACKEND_OUT,
        BACKEND_ERR,
    )
    frontend = launch(
        [str(VITE), "--host", "127.0.0.1", "--port", "5173"],
        FRONTEND,
        FRONTEND_OUT,
        FRONTEND_ERR,
    )

    backend_ok = probe("127.0.0.1", 5000)
    frontend_ok = probe("127.0.0.1", 5173)

    print(f"backend_pid={backend.pid} backend_ready={backend_ok}")
    print(f"frontend_pid={frontend.pid} frontend_ready={frontend_ok}")

    if backend_ok and frontend_ok:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
