# Contributing

Bug reports, accessibility improvements, browser-compatibility fixes, and focused UX improvements are welcome.

Before opening a pull request:

1. Keep `temporary-links.html` self-contained.
2. Do not add analytics, telemetry, uploads, remote logging, CDN assets, or runtime package downloads.
3. Keep the visual language aligned with `ttomohisa/htmlapps-template`.
4. Keep Japanese and English UI strings in sync.
5. Preserve compatibility with the `temporary-links-v1` persistent storage key unless a migration is included.
6. Test web URLs, local paths, retention modes, filters, search, Markdown export, and destructive actions.
7. Remove sensitive URLs, file paths, tokens, hostnames, and personal data from screenshots or reproduction steps.

The floating-window feature should be tested separately in a supported HTTPS environment because Document Picture-in-Picture availability is browser- and context-dependent.
