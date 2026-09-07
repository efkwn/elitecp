#!/usr/bin/env bash
set -Eeuo pipefail

SRC_DIR="/opt/elitecp/src"
BIN_PATH="/usr/local/bin/elitecp"
ENV_FILE="/etc/elitecp/elitecp.env"

[[ $EUID -eq 0 ]] || { echo "[x] root is required" >&2; exit 1; }
[[ -d "$SRC_DIR/.git" ]] || { echo "[x] eLite CP source directory not found: $SRC_DIR" >&2; exit 1; }

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
DB_PATH="${ELITECP_DB:-/var/lib/elitecp/elitecp.db}"
DATA_DIR="${ELITECP_DATA_DIR:-/var/lib/elitecp}"

printf '\n eLite CP updater\n────────────────────────────────────────────\n'

if [[ -f "$DB_PATH" ]] && command -v sqlite3 >/dev/null 2>&1; then
  mkdir -p "$DATA_DIR/backups"
  BACKUP="$DATA_DIR/backups/elitecp-$(date +%Y%m%d-%H%M%S).db"
  echo "[i] Creating a SQLite backup..."
  sqlite3 "$DB_PATH" ".backup '$BACKUP'"
  chown elitecp:elitecp "$BACKUP" 2>/dev/null || true
  chmod 0640 "$BACKUP" 2>/dev/null || true
  echo "[✓] Backup: $BACKUP"
fi

echo "[i] Fetching GitHub main branch..."
cd "$SRC_DIR"
git fetch --depth 1 origin main
git reset --hard origin/main

echo "[i] Running tests and building eLite CP..."
CGO_ENABLED=1 go test ./...
CGO_ENABLED=1 go build -trimpath -ldflags='-s -w' -o /tmp/elitecp-bin .
install -o root -g root -m 0755 /tmp/elitecp-bin "$BIN_PATH"
rm -f /tmp/elitecp-bin

echo "[i] Restarting service..."
systemctl restart elitecp
sleep 1
if ! systemctl is-active --quiet elitecp; then
  journalctl -u elitecp -n 80 --no-pager
  echo "[x] eLite CP failed to start." >&2
  exit 1
fi

VERSION="$($BIN_PATH version 2>/dev/null || true)"
echo "[✓] $VERSION"
echo "[✓] Update complete."
echo "[i] Existing bot data is preserved. Older containers are recreated automatically on the next Start/Restart when required by the runtime schema."
printf '────────────────────────────────────────────\n\n'
