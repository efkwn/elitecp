<div align="center">

# eLite CP

**A lightweight Docker control panel for Discord and Telegram bots.**

Go · SQLite · Docker · Vanilla HTML/CSS/JS

[Installation](#installation) · [Updating](#updating) · [CloudPanel](#cloudpanel--cloudflare) · [Security](#security)

</div>

---

> **v0.6.0** — Bot files can now be downloaded directly from the file manager, and every bot gets a built-in **read-only SQLite Explorer** that automatically detects SQLite databases, lists their tables and previews rows with pagination. The frontend remains framework-free and dependency-light.

## Why eLite CP?

eLite CP is a small bot-hosting control panel designed for people who want a Pterodactyl/PufferPanel-style workflow without running a large stack. The current focus is **Discord and Telegram bots** running on **Python 3.12** or **Node.js 22**.

Each bot runs in its own Docker container and has its own persistent application directory. Python dependencies are installed into a **per-bot virtual environment**, while Node.js dependencies stay inside that bot's own `node_modules` directory.

## Features

- Go backend with an embedded web UI — one service, one binary
- SQLite database — no MySQL/PostgreSQL server required
- Python 3.12 and Node.js 22 runtimes
- One isolated Docker container per bot
- Persistent per-bot Python virtual environment at `/app/.elitecp/venv`
- Persistent per-bot Node.js `node_modules`
- Startup pipeline with:
  - dependency file
  - install command
  - main file
  - startup command
- Automatic dependency reinstall when `requirements.txt` / `package.json` changes
- Manual **Reinstall Dependencies** action
- Start / Stop / Restart / Rebuild controls
- CPU and RAM limits
- OOM and exit-code visibility
- Live Docker logs through Server-Sent Events
- Interactive container command execution
- Environment variable / token management
- File manager and text editor
- Direct per-file downloads from the bot file manager
- Built-in read-only SQLite Explorer with automatic database detection, table browsing and paginated row previews
- Drag-and-drop upload and safe ZIP extraction
- VPS CPU / RAM / disk / uptime cards with lightweight inline sparklines
- Responsive light UI with local SVG icons
- English default UI + Turkish secondary language
- Debian 11 interactive installer
- CloudPanel reverse-proxy auto configuration when `clpctl` is available
- Automatic Let's Encrypt attempt on CloudPanel
- No React, Vue, Next.js, Bootstrap, Tailwind runtime, Chart.js, Google Fonts or icon CDN

## Architecture

```text
Cloudflare / DNS
       |
CloudPanel NGINX :80 / :443
       |
127.0.0.1:9080
       |
    eLite CP
  Go + SQLite
       |
 Docker Engine
   /       \
Python    Node.js
 Bot        Bot
```

eLite CP binds to **`127.0.0.1:9080`** by default. It does not take over ports `80` or `443`, so it can live next to an existing CloudPanel installation.

## Runtime isolation

Bot libraries are not installed into the host Python or mixed between bots.

```text
VPS host
└── Docker
    ├── Bot A / Python
    │   └── /app/.elitecp/venv
    ├── Bot B / Python
    │   └── /app/.elitecp/venv
    └── Bot C / Node.js
        └── /app/node_modules
```

Each bot's `/app` directory is backed by:

```text
/var/lib/elitecp/bots/<bot-id>/app/
```

Docker containers are not virtual machines and still share the host kernel, but application files, processes and dependencies are separated per container.

## Startup pipeline

For a typical Python Telegram bot:

```text
Dependency file: requirements.txt
Main file:       bot.py
Install command: python -m pip install --disable-pip-version-check -r {{dependency_file}}
Startup command: python {{main_file}}
```

A start then follows this sequence:

```text
1. Prepare the Python container
2. Create/activate /app/.elitecp/venv
3. Check the dependency-file fingerprint
4. Install packages only when needed
5. Start the application
```

For code containing:

```python
import telebot
```

put this in `requirements.txt`:

```text
pyTelegramBotAPI
```

For Node.js, the defaults are:

```text
Dependency file: package.json
Main file:       index.js
Install command: npm ci --omit=dev (when package-lock.json exists), otherwise npm install --omit=dev
Startup command: node {{main_file}}
```

## Requirements

The one-command installer currently targets:

- Debian 11 (Bullseye)
- root access
- x86_64/amd64 or arm64
- internet access for APT, GitHub, Go and Docker image pulls
- a VPS/VM capable of running Docker

For domain setup you should point an `A`/`AAAA` record to the VPS before installation.

## Installation

### One-command installer

Connect to your Debian 11 VPS over SSH and run:

```bash
curl -fsSL https://raw.githubusercontent.com/efkwn/elitecp/main/install.sh -o /tmp/elitecp-install.sh && sudo bash /tmp/elitecp-install.sh
```

The installer asks for:

1. admin username
2. admin password
3. whether you want to configure a domain
4. the domain name, for example `cp.example.com`

It then:

- installs required Debian packages
- enables Docker
- installs Go when a suitable version is not already available
- creates the `elitecp` system user
- clones this repository to `/opt/elitecp/src`
- builds `/usr/local/bin/elitecp`
- creates the SQLite database and admin account
- installs/enables the systemd service
- binds eLite CP to `127.0.0.1:9080`
- detects CloudPanel and attempts to create a reverse proxy
- attempts to issue a Let's Encrypt certificate through CloudPanel

After installation:

```bash
systemctl status elitecp --no-pager
elitecp version
elitecp doctor
```

Live logs:

```bash
journalctl -u elitecp -f
```

## CloudPanel + Cloudflare

If CloudPanel is installed and `clpctl` is available, the installer attempts to create a **Reverse Proxy Site** pointing your domain to:

```text
http://127.0.0.1:9080
```

Recommended first-time Cloudflare flow:

1. Create an `A` record such as `cp.example.com` pointing to the VPS IP.
2. Temporarily set the record to **DNS only** during the initial certificate issuance if Let's Encrypt has trouble.
3. Run the eLite CP installer and enter the domain when asked.
4. Confirm `https://cp.example.com` works.
5. You may then enable Cloudflare proxying again.
6. Prefer **Full (strict)** in Cloudflare SSL/TLS once the origin certificate is valid.

If the domain already exists in CloudPanel, automatic reverse-proxy creation may fail harmlessly. In that case create or edit the reverse proxy manually and use `http://127.0.0.1:9080` as the target.

## Manual reverse proxy without CloudPanel

You can use any reverse proxy. The upstream is:

```text
http://127.0.0.1:9080
```

Keep eLite CP bound to localhost and terminate public HTTP/HTTPS at your existing NGINX/Caddy/Apache proxy.

## Creating your first bot

1. Sign in to eLite CP.
2. Click **New Bot**.
3. Choose Python 3.12 or Node.js 22.
4. Set RAM and CPU limits.
5. Create the bot.
6. Open **Files** and upload your source files. You can also download any regular bot file directly from this page.
7. Put secrets such as bot tokens under **Variables**.
8. Check **Startup & Settings**.
9. Press **Start**.
10. Follow every startup step from **Console**.
11. If your bot creates a SQLite database, open the **SQLite** tab to browse its tables and rows without installing a separate database viewer.


## SQLite Explorer

The **SQLite** tab scans the selected bot's persistent application directory for real SQLite database files by file signature, so common names such as `bot.db`, `data.sqlite` and `users.sqlite3` work automatically. Runtime/cache directories such as `node_modules` and per-bot virtual environments are skipped to keep scans lightweight.

The explorer is intentionally **read-only**. It can:

- discover SQLite databases inside the bot files
- list user tables
- preview up to 100 rows per page
- paginate through larger tables
- display `NULL`, numeric, text and BLOB-size values safely
- download the selected database file

It does not expose arbitrary SQL execution or database writes. A running bot may continue updating its database while it is being viewed; use **Refresh** to fetch the latest state.

## Updating

The updater creates a SQLite backup before fetching and building the latest `main` branch.

```bash
curl -fsSL https://raw.githubusercontent.com/efkwn/elitecp/main/update.sh -o /tmp/elitecp-update.sh && sudo bash /tmp/elitecp-update.sh
```

Or, on an existing standard installation:

```bash
sudo /opt/elitecp/src/update.sh
```

Then verify:

```bash
elitecp version
systemctl status elitecp --no-pager
journalctl -u elitecp -n 80 --no-pager
```

SQLite migrations run automatically. Existing bot data and bind-mounted bot files are preserved.

## Data locations

```text
/var/lib/elitecp/elitecp.db
/var/lib/elitecp/bots/<bot-id>/app/
/var/lib/elitecp/backups/
/etc/elitecp/elitecp.env
/opt/elitecp/src/
```

To back up the full installation data, back up `/var/lib/elitecp` and `/etc/elitecp`.

## Service commands

```bash
systemctl status elitecp
systemctl restart elitecp
systemctl stop elitecp
journalctl -u elitecp -f
elitecp version
elitecp doctor
```

## Troubleshooting

### A Python module is missing

Make sure the package is listed in the bot's `requirements.txt`, then use **Reinstall Dependencies** or restart the bot.

Example:

```text
ModuleNotFoundError: No module named 'telebot'
```

requires:

```text
pyTelegramBotAPI
```

### The bot says `signal: killed`

Check the bot state and container logs. If Docker reports OOMKilled, raise the bot RAM limit or reduce memory usage.

### The panel works locally but the domain does not

Check:

```bash
systemctl status elitecp --no-pager
curl -I http://127.0.0.1:9080
```

Then verify your reverse proxy, DNS and TLS configuration.

### CloudPanel could not create the reverse proxy automatically

The domain may already exist. Create a CloudPanel **Reverse Proxy Site** manually with:

```text
Domain: your panel domain
Target: http://127.0.0.1:9080
```

## Security

This release is a **single-admin / small-hosting MVP**.

The `elitecp` system user needs Docker daemon access. On Linux, Docker daemon access is highly privileged. Before exposing eLite CP as a public multi-tenant commercial service, consider adding a separate node agent, RBAC, 2FA, audit logs, encrypted secrets, stricter sandboxing and stronger tenant isolation.

Bot source code and bot tokens remain the responsibility of the panel administrator.

See [SECURITY.md](SECURITY.md) for additional guidance.

## Development

On Debian/Ubuntu:

```bash
sudo apt install gcc libsqlite3-dev
CGO_ENABLED=1 go test ./...
CGO_ENABLED=1 go build -o elitecp .
```

Create a development admin:

```bash
mkdir -p ./data
ELITECP_DATA_DIR=./data ELITECP_DB=./data/dev.db ./elitecp setup-admin --username admin --password 'change-me-now'
```

Run locally:

```bash
ELITECP_DATA_DIR=./data \
ELITECP_DB=./data/dev.db \
ELITECP_LISTEN=127.0.0.1:9080 \
./elitecp
```

The Go backend intentionally uses no third-party Go modules. SQLite is accessed through the system `libsqlite3` library, while the UI is plain HTML/CSS/JavaScript with local SVG icons.

## License

MIT — see [LICENSE](LICENSE).
