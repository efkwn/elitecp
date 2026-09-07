# Upgrading eLite CP

## Upgrade to v0.6.1

v0.6.1 does not require a manual database migration. Existing users, bots, files, variables and startup settings are preserved.

Run:

```bash
curl -fsSL https://raw.githubusercontent.com/efkwn/elitecp/main/update.sh -o /tmp/elitecp-update.sh && sudo bash /tmp/elitecp-update.sh
```

The updater:

1. creates an eLite CP SQLite backup under `/var/lib/elitecp/backups/`
2. fetches the latest `main` branch
3. runs Go tests
4. builds the new binary
5. restarts the systemd service

Verify:

```bash
elitecp version
systemctl status elitecp --no-pager
journalctl -u elitecp -n 80 --no-pager
```

Expected version:

```text
eLite CP 0.6.1
```

## SQLite empty-table fix

This patch fixes the SQLite Explorer error that could appear when a selected table had zero rows. Empty tables now render the normal empty-state message instead of a JavaScript exception. A dedicated SQLite icon is also included.

## New SQLite Explorer

No package or database migration is required. The explorer reuses the system SQLite library already required by eLite CP and opens bot databases read-only.

If a SQLite database does not appear immediately, verify that it is a valid initialized SQLite file and press **Refresh** in the SQLite tab.

## Browser cache

Frontend assets are versioned as `v0.6.1`. If an old interface is still visible after the update, perform one hard refresh.
