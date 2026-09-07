# Changelog

## v0.6.1

### Fixed

- Fixed SQLite Explorer crashing with `Cannot read properties of null (reading 'length')` when opening an empty table.
- Empty SQLite tables now serialize row data as an empty array instead of `null`.
- Added defensive frontend normalization for SQLite row/column payloads so malformed or legacy empty responses render safely.
- Added a dedicated SQLite navigation icon and versioned the SVG sprite URL so newly-added icons cannot be hidden by an older browser cache.

## v0.6.0

### Added

- Added authenticated direct downloads for regular files in each bot's file manager.
- Added a new **SQLite** tab to the bot detail navigation.
- SQLite databases are discovered automatically by their real SQLite file signature rather than filename extension alone.
- Added read-only table discovery and paginated row previews (100 rows per page, server-side maximum 200).
- Added safe rendering for SQLite `NULL`, integer, floating-point, text and BLOB values.
- Added database download access directly from SQLite Explorer.
- Added local database/table/download SVG icons with no external icon dependency.
- Added full English and Turkish strings for the SQLite Explorer.

### Security / performance

- SQLite Explorer opens bot databases with SQLite read-only mode.
- Arbitrary SQL execution is not exposed.
- Table names are validated against `sqlite_master` before query construction and identifiers are safely quoted.
- File traversal and symlink protections are reused for downloads and database access.
- Database discovery skips dependency/runtime cache directories and uses scan/result caps to remain lightweight.

### UI

- Added a responsive two-pane database browser on desktop and stacked layout on mobile.
- Added horizontal scrolling for wide database tables.
- File download actions stay compact on mobile.

## v0.5.0

### Added

- English is now the default eLite CP interface language.
- Turkish is available as a built-in secondary language.
- Lightweight EN/TR switchers are available on the login screen, desktop top bar and sidebar.
- The selected language is persisted in `localStorage`.
- Dynamic dashboard, bot detail, file manager, environment, settings, console and toast text is localized.

### Fixed

- Fixed the mobile login screen becoming extremely narrow on small viewports.
- Improved safe-area padding for mobile browsers.

### Lightweight by design

- No frontend framework was added.
- No external font, icon or chart dependency was added.
- Localization is a small in-browser dictionary and DOM helper.
