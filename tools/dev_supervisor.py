from __future__ import annotations

import signal
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_OUT = ROOT / "backend-dev.out.log"
BACKEND_ERR = ROOT / "backend-dev.err.log"
FRONTEND_OUT = ROOT / "frontend" / "frontend-dev.out.log"
FRONTEND_ERR = ROOT / "frontend" / "frontend-dev.err.log"

PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"
VITE = ROOT / "frontend" / "node_modules" / ".bin" / "vite.cmd"

children: list[subprocess.Popen[str]] = []


def spawn(command: list[str], cwd: Path, stdout_path: Path, stderr_path: Path) -> subprocess.Popen[str]:
    stdout_path.write_text("", encoding="utf-8")
    stderr_path.write_text("", encoding="utf-8")
    stdout = stdout_path.open("a", encoding="utf-8")
    stderr = stderr_path.open("a", encoding="utf-8")
    process = subprocess.Popen(
        command,
        cwd=str(cwd),
        stdout=stdout,
        stderr=stderr,
        stdin=subprocess.DEVNULL,
        creationflags=0x00000200,
        close_fds=True,
    )
    children.append(process)
    return process


def shutdown(*_args) -> None:
    for child in children:
        if child.poll() is None:
            child.terminate()
    raise SystemExit(0)


def main() -> int:
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    spawn(
        [str(PYTHON), "-m", "flask", "--app", "backend\\app.py", "run", "--host", "127.0.0.1", "--port", "5000"],
        ROOT,
        BACKEND_OUT,
        BACKEND_ERR,
    )
    spawn(
        [str(VITE), "--host", "127.0.0.1", "--port", "5173"],
        ROOT / "frontend",
        FRONTEND_OUT,
        FRONTEND_ERR,
    )

    while True:
        for child in children:
            if child.poll() is not None:
                return 1
        time.sleep(1)


if __name__ == "__main__":
    raise SystemExit(main())
