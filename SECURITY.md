# Security Policy

Temporary Links is a client-side, single-HTML utility. It has no server component and is not designed to store secrets securely.

## Reporting a vulnerability

Please open a GitHub issue only when the report can be shared publicly without exposing sensitive URLs, local paths, hostnames, tokens, or personal information.

For a report that includes sensitive reproduction data, use GitHub's private vulnerability reporting feature if it is enabled for the repository.

## Security model

- The app stores user-entered links, paths, notes, and preferences in browser storage.
- The app does not encrypt browser storage.
- The app does not upload user data.
- Runtime network connections from the app are blocked by Content Security Policy.
- Opening a saved web link is an explicit user navigation to that destination.
- Local file paths are treated as text references; the app does not verify whether the referenced file exists.

Do not store passwords, access tokens, private keys, or other secrets in Temporary Links.
