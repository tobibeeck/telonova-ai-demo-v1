#!/usr/bin/env python3
"""Deploy telonova-ai-demo-v1 to the server via SSH."""

from __future__ import annotations

import pathlib
import re
import sys
import time

import paramiko

HOST = "172.20.20.69"
USER = "telonova"
PASSWORD = "telonova"
REMOTE_DIR = "/opt/telonova"
REPO = "https://github.com/tobibeeck/telonova-ai-demo-v1.git"
SUDO = f"echo {PASSWORD} | sudo -S"


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe = out.rstrip().encode(sys.stdout.encoding or "utf-8", errors="replace").decode(
            sys.stdout.encoding or "utf-8", errors="replace"
        )
        print(safe)
    if err.strip():
        safe_err = err.rstrip().encode(sys.stdout.encoding or "utf-8", errors="replace").decode(
            sys.stdout.encoding or "utf-8", errors="replace"
        )
        print(safe_err, file=sys.stderr)
    return code, out, err


def prepare_env_local(root: pathlib.Path) -> str:
    src = root / ".env.local"
    if not src.exists():
        raise FileNotFoundError(f"{src} not found")

    text = src.read_text(encoding="utf-8")
    text = re.sub(
        r"^GOOGLE_APPLICATION_CREDENTIALS=.*$",
        "GOOGLE_APPLICATION_CREDENTIALS=/app/data/gcp-service-account.json",
        text,
        flags=re.MULTILINE,
    )
    text = re.sub(
        r"^OLLAMA_BASE_URL=.*$",
        "OLLAMA_BASE_URL=http://ollama:11434",
        text,
        flags=re.MULTILINE,
    )
    text = re.sub(
        r"^DATABASE_PATH=.*$",
        "DATABASE_PATH=/app/data/telonova.db",
        text,
        flags=re.MULTILINE,
    )
    return text


def main() -> int:
    root = pathlib.Path(__file__).resolve().parents[1]
    env_content = prepare_env_local(root)

    print(f"Connecting to {USER}@{HOST} …")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    except Exception as exc:
        print(f"SSH failed: {exc}", file=sys.stderr)
        print(
            "Server not reachable. Use VPN / same LAN, then run:\n"
            "  python scripts/deploy-remote.py",
            file=sys.stderr,
        )
        return 1

    sftp = client.open_sftp()

    code, _, _ = run(client, f"test -d {REMOTE_DIR} && echo OK || echo MISSING")
    if "MISSING" in _:
        run(client, f"sudo mkdir -p {REMOTE_DIR} && sudo chown {USER}:{USER} {REMOTE_DIR}")

    code, out, _ = run(client, f"test -d {REMOTE_DIR}/.git && echo GIT || echo NOGIT")
    if "NOGIT" in out:
        run(client, f"git clone {REPO} {REMOTE_DIR}")
    else:
        run(client, f"cd {REMOTE_DIR} && git fetch origin && git reset --hard origin/main")

    run(client, "git config --global --add safe.directory /opt/telonova || true")
    run(client, f"{SUDO} chown -R {USER}:{USER} {REMOTE_DIR} || true")
    run(client, f"{SUDO} usermod -aG docker {USER} || true")
    run(client, f"mkdir -p {REMOTE_DIR}/data")
    run(client, f"{SUDO} chown -R 1001:1001 {REMOTE_DIR}/data")
    run(client, f"{SUDO} chmod -R u+rwX,g+rwX {REMOTE_DIR}/data")

    prod_compose = root / "docker-compose.prod.yml"
    if prod_compose.exists():
        sftp.put(str(prod_compose), f"{REMOTE_DIR}/docker-compose.prod.yml")

    with sftp.file(f"{REMOTE_DIR}/.env.local", "w") as remote_env:
        remote_env.write(env_content)

    local_gcp = root / "data" / "gcp-service-account.json"
    if local_gcp.exists():
        sftp.put(str(local_gcp), f"{REMOTE_DIR}/data/gcp-service-account.json")
        print("Uploaded gcp-service-account.json")
    else:
        code, out, _ = run(
            client,
            f"test -f {REMOTE_DIR}/data/gcp-service-account.json && echo GCP_OK || echo GCP_MISSING",
        )
        if "GCP_MISSING" in out:
            print(
                "WARNING: data/gcp-service-account.json missing locally and on server. "
                "Gemini will not work until you add it.",
                file=sys.stderr,
            )

    compose = (
        f"{SUDO} docker compose -f docker-compose.yml -f docker-compose.prod.yml"
    )
    run(
        client,
        f"{SUDO} docker run --rm -v telonova_app_data:/from:ro -v {REMOTE_DIR}/data:/to "
        f"alpine sh -c 'cp -an /from/. /to/ 2>/dev/null || true'",
    )
    run(client, f"cd {REMOTE_DIR} && {compose} down || true")
    code, _, _ = run(client, f"cd {REMOTE_DIR} && {compose} up -d --build", timeout=1800)
    if code != 0:
        return code

    print("Waiting for Ollama …")
    for _ in range(30):
        code, out, _ = run(
            client,
            f"cd {REMOTE_DIR} && {SUDO} docker compose exec -T ollama ollama list 2>/dev/null || echo WAIT",
        )
        if "WAIT" not in out:
            break
        time.sleep(5)

    run(
        client,
        f"cd {REMOTE_DIR} && {SUDO} docker compose exec -T ollama ollama pull llama3.2:1b",
        timeout=1800,
    )
    run(client, f"cd {REMOTE_DIR} && {compose} ps")

    sftp.close()
    client.close()
    print(f"\nDone. Open http://{HOST}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
