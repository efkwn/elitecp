# Upgrading eLite CP

## Upgrade to v0.5.0

v0.5.0 does not require a manual database migration. Existing users, bots, files, environment variables and startup settings are preserved.

Run:

```bash
curl -fsSL https://raw.githubusercontent.com/efkwn/elitecp/main/update.sh -o /tmp/elitecp-update.sh && sudo bash /tmp/elitecp-update.sh
```

The updater:

1. creates a SQLite backup under `/var/lib/elitecp/backups/`
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
eLite CP 0.5.0
```

## Browser cache

If the old interface is still visible after the update, perform a hard refresh or clear the site cache once. No browser data needs to be deleted for normal upgrades.

## Language preference

English is the default for browsers that have never selected a language. If a user changes the UI to Turkish, eLite CP stores that preference locally in the browser.
