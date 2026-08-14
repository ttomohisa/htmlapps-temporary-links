# Changelog

## 1.0 - 2026-08-14

### Changed

- Reworked the entire UI to match `htmlapps-template`.
- Standardized the light palette, green accent, sticky header, version badge, language switch, help dialog, spacing, buttons, and responsive behavior.
- Added Japanese / English UI switching.
- Added search and a dedicated Expired filter.
- Improved local-path actions and Markdown export formatting.
- Added a GitHub Pages root redirect while keeping `temporary-links.html` as the distributable app.

### Fixed

- Fixed mixed Japanese/English and corrupted UI messages in the previous HTML.
- Fixed rich-link paste detection so the detected link title is actually saved.
- Changed tab-session retention to use `sessionStorage` instead of relying on `beforeunload` cleanup.
- Preserved existing persistent data in `temporary-links-v1` and added automatic migration for legacy session entries.
- Added safe storage fallbacks and a `crypto.randomUUID()` fallback ID generator.

### Security / privacy

- Added an explicit Content Security Policy with runtime connections disabled.
- Kept the app dependency-free and self-contained at runtime.
