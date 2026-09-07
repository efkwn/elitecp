#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "root gerekli"; exit 1; }
SRC_DIR=/opt/elitecp/src
[[ -d "$SRC_DIR/.git" ]] || { echo "eLite CP kaynak dizini bulunamadı"; exit 1; }
cd "$SRC_DIR"
git fetch --depth 1 origin main
git reset --hard origin/main
CGO_ENABLED=1 go build -trimpath -ldflags='-s -w' -o /tmp/elitecp-bin .
install -o root -g root -m 0755 /tmp/elitecp-bin /usr/local/bin/elitecp
rm -f /tmp/elitecp-bin
systemctl restart elitecp
systemctl --no-pager --full status elitecp | head -20
