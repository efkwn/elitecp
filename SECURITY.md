# Security Policy

## Current scope

eLite CP is currently designed as a single-admin / small-hosting control panel for trusted operators. It is not yet positioned as a hardened public multi-tenant hosting platform.

## Docker privilege model

The `elitecp` service account is a member of the Docker group so it can create, start, stop and inspect bot containers. On Linux, access to the Docker daemon is highly privileged and should be treated similarly to root-level host access.

Do not give untrusted users shell access to the VPS or access to the eLite CP service account.

## Bot containers

eLite CP applies container-level resource and privilege restrictions, but Docker containers still share the host kernel. Before offering untrusted public multi-tenant workloads, consider a dedicated node-agent architecture and stronger sandboxing boundaries.

Recommended future hardening includes:

- role-based access control
- two-factor authentication
- audit logs
- encrypted secrets at rest
- per-user and per-node quotas
- separate execution nodes
- stricter seccomp/AppArmor policies
- image allowlists
- rate limiting
- CSRF/session hardening review
- automated security updates and vulnerability scanning

## Secrets

Discord tokens, Telegram tokens and other environment variables are sensitive. Restrict access to backups and `/var/lib/elitecp` because application data may contain secrets.

## Network exposure

The default service bind address is `127.0.0.1:9080`. Keep it bound to localhost and expose the panel through a trusted HTTPS reverse proxy such as CloudPanel NGINX or Caddy.

## Reporting vulnerabilities

If you discover a security issue, avoid posting sensitive exploit details publicly before the maintainer has had a reasonable chance to review and fix it. Use a private GitHub security advisory when available.

## File downloads and SQLite Explorer

Bot file downloads are authenticated and reuse the same root-containment and symlink rejection checks as the file editor.

SQLite Explorer is intentionally read-only. It does not provide arbitrary SQL execution or write operations. A database path must resolve inside the selected bot directory, must be a regular non-symlink file, and must contain a valid SQLite file signature before it is opened with `SQLITE_OPEN_READONLY`. Table names are first validated against `sqlite_master` and then safely quoted before row previews are queried.
