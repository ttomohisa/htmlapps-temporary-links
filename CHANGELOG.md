# Changelog

## Unreleased

### Added

- Choose all items or current filtered/search results for Markdown export, with localized count and filename previews. The choice is page-only; empty current results cannot silently export all items.

- Edit existing URL/path and note from the main list, including completed and expired items.
- Keep item identity, retention, completion, order, storage ownership and Add drafts when editing.
- Validate changed destinations, preserve or clear clipboard titles appropriately, and synchronize search/export/floating references.
- Preserve edit drafts on storage failure and protect against floating-window completion/removal races.
- Add Japanese/English edit help and dependency-free Node.js behavior tests in the PR preview workflow.

### Fixed

- Share URL validation between Add and Edit so malformed web/file URLs cannot be added while valid local references stay supported.
- Ignore IME composition Enter (including keyCode 229) in main/floating Add and Edit, preserving drafts until a normal Enter.
- Clean up temporary anchors/object URLs when download initiation throws, report the error, and describe successful initiation without claiming a completed disk save.

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
