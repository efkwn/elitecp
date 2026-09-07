#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/efkwn/elitecp.git"
RAW_URL="https://raw.githubusercontent.com/efkwn/elitecp/main"
SRC_DIR="/opt/elitecp/src"
DATA_DIR="/var/lib/elitecp"
ENV_DIR="/etc/elitecp"
BIN_PATH="/usr/local/bin/elitecp"
LISTEN="127.0.0.1:9080"
TTY="/dev/tty"

C_RESET='\033[0m'; C_PURPLE='\033[38;5;141m'; C_GREEN='\033[38;5;78m'; C_YELLOW='\033[38;5;221m'; C_RED='\033[38;5;203m'; C_BOLD='\033[1m'
info(){ printf "%b[i]%b %s\n" "$C_PURPLE" "$C_RESET" "$*"; }
ok(){ printf "%b[✓]%b %s\n" "$C_GREEN" "$C_RESET" "$*"; }
warn(){ printf "%b[!]%b %s\n" "$C_YELLOW" "$C_RESET" "$*"; }
die(){ printf "%b[x]%b %s\n" "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

prompt(){ local __var="$1" __text="$2" __default="${3:-}" value=""; if [[ -n "$__default" ]]; then read -r -p "$__text [$__default]: " value < "$TTY" || true; value="${value:-$__default}"; else read -r -p "$__text: " value < "$TTY" || true; fi; printf -v "$__var" '%s' "$value"; }
prompt_secret(){ local __var="$1" __text="$2" value=""; read -r -s -p "$__text: " value < "$TTY" || true; printf '\n' > "$TTY"; printf -v "$__var" '%s' "$value"; }
yesno(){ local __text="$1" __default="${2:-Y}" answer=""; read -r -p "$__text [$__default]: " answer < "$TTY" || true; answer="${answer:-$__default}"; [[ "$answer" =~ ^[YyEe]$ ]]; }

[[ $EUID -eq 0 ]] || die "Kurulum root olarak çalıştırılmalı."
[[ -r /etc/os-release ]] || die "İşletim sistemi algılanamadı."
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == "debian" && "${VERSION_ID:-}" == "11" ]] || die "Bu kurucu Debian 11 (Bullseye) içindir. Bulunan: ${PRETTY_NAME:-bilinmiyor}"

printf "\n%b%b eLite CP%b  · Bot Hosting Control Panel\n" "$C_BOLD" "$C_PURPLE" "$C_RESET"
printf "────────────────────────────────────────────\n\n"
warn "Kurulum Docker ağı/iptables kurallarını ekleyebilir. VPS snapshot/backup almak iyi fikirdir."
printf "\n"

prompt ADMIN_USER "Admin kullanıcı adı" "admin"
[[ "$ADMIN_USER" =~ ^[A-Za-z0-9_.-]{3,64}$ ]] || die "Admin kullanıcı adı 3-64 karakter ve yalnızca harf/rakam/._- içermeli."
while true; do
  prompt_secret ADMIN_PASS "Admin şifre (en az 10 karakter)"
  [[ ${#ADMIN_PASS} -ge 10 ]] || { warn "Şifre en az 10 karakter olmalı."; continue; }
  prompt_secret ADMIN_PASS2 "Admin şifre tekrar"
  [[ "$ADMIN_PASS" == "$ADMIN_PASS2" ]] && break
  warn "Şifreler eşleşmedi."
done
unset ADMIN_PASS2

USE_DOMAIN="no"; DOMAIN=""
if yesno "Domain bağlamak ister misin?" "Y"; then
  USE_DOMAIN="yes"
  prompt DOMAIN "Domain" "cp.efkwn.fun"
  DOMAIN="${DOMAIN,,}"
  [[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || die "Geçersiz domain: $DOMAIN"
fi

info "Gerekli Debian paketleri kuruluyor..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl git gcc libc6-dev libsqlite3-dev sqlite3 docker.io openssl tar gzip
systemctl enable --now docker
ok "Docker hazır."

need_go="yes"
if command -v go >/dev/null 2>&1; then
  current="$(go version | awk '{print $3}' | sed 's/^go//')"
  if printf '%s\n%s\n' "1.22.0" "$current" | sort -V -C; then need_go="no"; fi
fi
if [[ "$need_go" == "yes" ]]; then
  info "Güncel Go sürümü kuruluyor..."
  GO_VERSION="$(curl -fsSL 'https://go.dev/VERSION?m=text' | head -n1 | sed 's/^go//')"
  [[ "$GO_VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || die "Go sürümü alınamadı."
  case "$(uname -m)" in x86_64) GO_ARCH=amd64;; aarch64|arm64) GO_ARCH=arm64;; *) die "Desteklenmeyen mimari: $(uname -m)";; esac
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -o /tmp/elitecp-go.tar.gz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/elitecp-go.tar.gz
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
  rm -f /tmp/elitecp-go.tar.gz
  export PATH="/usr/local/go/bin:$PATH"
  ok "Go ${GO_VERSION} kuruldu."
fi

if ! id elitecp >/dev/null 2>&1; then
  useradd --system --home "$DATA_DIR" --create-home --shell /usr/sbin/nologin elitecp
fi
usermod -aG docker elitecp
install -d -o elitecp -g elitecp -m 0750 "$DATA_DIR" "$DATA_DIR/bots"
install -d -o root -g root -m 0755 /opt/elitecp "$ENV_DIR"

info "eLite CP kaynak kodu alınıyor..."
if [[ -d "$SRC_DIR/.git" ]]; then
  git -C "$SRC_DIR" fetch --depth 1 origin main
  git -C "$SRC_DIR" reset --hard origin/main
else
  rm -rf "$SRC_DIR"
  git clone --depth 1 --branch main "$REPO_URL" "$SRC_DIR"
fi

info "eLite CP derleniyor..."
cd "$SRC_DIR"
CGO_ENABLED=1 go build -trimpath -ldflags='-s -w' -o /tmp/elitecp-bin .
install -o root -g root -m 0755 /tmp/elitecp-bin "$BIN_PATH"
rm -f /tmp/elitecp-bin
ok "Binary kuruldu: $BIN_PATH"

PUBLIC_URL=""
[[ "$USE_DOMAIN" == "yes" ]] && PUBLIC_URL="https://$DOMAIN"
cat > "$ENV_DIR/elitecp.env" <<ENVEOF
ELITECP_LISTEN=$LISTEN
ELITECP_DATA_DIR=$DATA_DIR
ELITECP_DB=$DATA_DIR/elitecp.db
ELITECP_PUBLIC_URL=$PUBLIC_URL
ENVEOF
chmod 0640 "$ENV_DIR/elitecp.env"

printf '%s' "$ADMIN_PASS" | runuser -u elitecp -- env ELITECP_DATA_DIR="$DATA_DIR" ELITECP_DB="$DATA_DIR/elitecp.db" "$BIN_PATH" setup-admin --username "$ADMIN_USER" --password-stdin
unset ADMIN_PASS
ok "Admin hesabı hazır."

install -o root -g root -m 0644 "$SRC_DIR/systemd/elitecp.service" /etc/systemd/system/elitecp.service
systemctl daemon-reload
systemctl enable --now elitecp
sleep 1
systemctl is-active --quiet elitecp || { journalctl -u elitecp -n 50 --no-pager; die "eLite CP servisi başlatılamadı."; }
ok "eLite CP servisi aktif: http://$LISTEN"

DOMAIN_READY="no"
if [[ "$USE_DOMAIN" == "yes" ]]; then
  if command -v clpctl >/dev/null 2>&1; then
    info "CloudPanel reverse proxy oluşturuluyor..."
    SITE_USER="elitecp$(openssl rand -hex 2)"
    SITE_PASS="$(openssl rand -base64 24 | tr -d '\n/+=' | cut -c1-24)Aa1!"
    if clpctl site:add:reverse-proxy --domainName="$DOMAIN" --reverseProxyUrl="http://$LISTEN" --siteUser="$SITE_USER" --siteUserPassword="$SITE_PASS" >/tmp/elitecp-clp.log 2>&1; then
      ok "CloudPanel reverse proxy oluşturuldu."
      DOMAIN_READY="yes"
      info "Let's Encrypt sertifikası deneniyor..."
      if clpctl lets-encrypt:install:certificate --domainName="$DOMAIN" >/tmp/elitecp-le.log 2>&1; then
        ok "HTTPS sertifikası kuruldu."
      else
        warn "Let's Encrypt otomatik kurulamadı. CloudPanel > $DOMAIN > SSL/TLS bölümünden tekrar deneyebilirsin."
      fi
    else
      warn "CloudPanel site otomatik oluşturulamadı. Domain zaten ekliyse bu normal olabilir."
      warn "Log: /tmp/elitecp-clp.log"
    fi
  else
    warn "CloudPanel (clpctl) bulunamadı; domain otomatik bağlanmadı."
  fi
fi

printf "\n────────────────────────────────────────────\n"
printf "%b%b Kurulum tamamlandı!%b\n" "$C_BOLD" "$C_GREEN" "$C_RESET"
printf " Admin: %s\n" "$ADMIN_USER"
if [[ "$USE_DOMAIN" == "yes" && "$DOMAIN_READY" == "yes" ]]; then
  printf " Panel: %bhttps://%s%b\n" "$C_PURPLE" "$DOMAIN" "$C_RESET"
else
  printf " Lokal servis: http://%s\n" "$LISTEN"
fi
printf " Servis: systemctl status elitecp\n"
printf " Loglar: journalctl -u elitecp -f\n"
printf "────────────────────────────────────────────\n\n"
