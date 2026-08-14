# Temporary Links

[日本語](README.ja.md)

![Temporary Links preview](assets/social-preview.png)

A small, self-contained browser tool for keeping **short-lived web links and local file paths** close at hand while you work.

Temporary Links is intentionally not a permanent bookmark manager. It is a temporary work queue: add the references you need now, mark them done, and clear them when the task is over.

## Demo

After publishing this repository with GitHub Pages:

- [htmlapps-temporary-links](https://ttomohisa.github.io/htmlapps-temporary-links/)
- Available at [temporary-links.html](https://ttomohisa.github.io/htmlapps-temporary-links/temporary-links.html) .

## Highlights

- Single self-contained `temporary-links.html`
- No external runtime dependencies
- Content Security Policy blocks runtime network connections from the app
- Links, notes, and paths stay in browser storage
- Japanese / English UI switch
- `http://` and `https://` web links
- `file:///...`, Windows paths, UNC paths, and absolute local paths
- Optional note and retention period
- True tab-session items stored in `sessionStorage`
- Persistent items stored in the existing `temporary-links-v1` key for compatibility
- Active / All / Done / Expired filters
- Search by title, URL, path, or note
- Copy path / parent folder / file name for local references
- Markdown export
- Optional always-on-top floating window using Document Picture-in-Picture
- Keyboard-friendly and responsive layout

## Quick start

1. Download `temporary-links.html`.
2. Open it in a modern browser, or use the GitHub Pages version.
3. Paste a web URL or local file path.
4. Optionally add a note and choose how long to keep it.
5. Select **Add**.

Core list features work as a local HTML file. The floating window uses the Document Picture-in-Picture API, which requires a supported **secure context (HTTPS)**. For that feature, use the GitHub Pages version or another supported HTTPS host.

## Supported input

| Type | Example | Main action |
|---|---|---|
| Web URL | `https://example.com` | Open in a new tab |
| File URL | `file:///C:/Users/name/report.xlsx` | Copy local path |
| Windows path | `C:\work\report.xlsx` | Copy path / folder / name |
| UNC path | `\\server\share\report.xlsx` | Copy path / folder / name |
| Absolute path | `/Users/name/report.pdf` | Copy path / folder / name |

Normal web pages cannot reliably launch arbitrary local files or desktop applications, so Temporary Links deliberately treats local paths as references and provides copy actions instead of a misleading Open button.

## Retention

| Setting | Storage / behavior |
|---|---|
| Until this tab closes | `sessionStorage`; disappears when the tab session ends |
| Until today | Expires at the end of the current day |
| Until 3 days from now | Expires at the end of that day |
| Until 7 days from now | Expires at the end of that day |
| Until removed | Remains until manually removed |

Expired items stay available in **All** and **Expired** until you remove them.

## Compatibility with the previous version

Persistent data continues to use:

```text
temporary-links-v1
```

Legacy entries whose `expiresAt` value is `session` are automatically moved to the new tab-session storage on first load. Existing saved persistent links therefore continue to work without a manual migration.

## Floating window

When `window.documentPictureInPicture` is available in a secure context, **Floating window** opens a compact always-on-top view containing active items.

The floating view can:

- show active references
- open web links
- copy local paths
- mark items done
- remove items
- add a URL or path as a tab-session item

If the API is unavailable, the button is disabled and the normal list remains fully usable.

## Privacy and offline behavior

Temporary Links does not include analytics, telemetry, uploads, remote logging, CDN assets, or third-party runtime requests.

The HTML includes a restrictive Content Security Policy with `connect-src 'none'`. Opening a web link is an explicit user navigation; the app itself does not fetch that destination.

Be aware that browser-local storage can be read by other people using the same browser profile. Do not use Temporary Links as an encrypted secret store.

## Repository structure

```text
htmlapps-temporary-links/
├── index.html                 # GitHub Pages root redirect
├── temporary-links.html       # The app; self-contained distribution
├── README.md
├── README.ja.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
└── assets/
    └── social-preview.png
```

## Development checks

The app intentionally has no build step. Before publishing changes:

1. Run a JavaScript syntax check against the inline script.
2. Verify there are no runtime CDN or network dependencies.
3. Test web URLs, `file:///` URLs, Windows paths, UNC paths, and absolute paths.
4. Test each retention mode and the four list filters.
5. Test Japanese and English UI.
6. Test local-file core behavior and HTTPS floating-window behavior separately.
7. Test Markdown export and destructive-action confirmations.

## License

MIT License. See [LICENSE](LICENSE).
