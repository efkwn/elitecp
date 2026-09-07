# Changelog

## v0.5.0

### Added

- English is now the default eLite CP interface language.
- Turkish is available as a built-in secondary language.
- Lightweight EN/TR switchers are available on the login screen, desktop top bar and sidebar.
- The selected language is persisted in `localStorage`.
- Dynamic dashboard, bot detail, file manager, environment, settings, console and toast text is localized.

### Fixed

- Fixed the mobile login screen becoming extremely narrow on small viewports.
- The issue was caused by a later premium desktop grid rule overriding the earlier mobile login grid declaration.
- Added a final responsive login layout guard using a single minmax grid track and a full-width, max-width-capped login card.
- Improved safe-area padding for mobile browsers.

### Documentation

- Rewrote README, SECURITY and UPGRADE documentation in English.
- Reworked installation instructions for public GitHub users.
- Removed the project-owner-specific domain default from the installer.
- Installer and updater terminal output are now English.

### Lightweight by design

- No frontend framework was added.
- No external font, icon or chart dependency was added.
- Localization is a small in-browser dictionary and DOM helper.
