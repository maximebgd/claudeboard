# Security Policy

## Scope

claudeboard is a **local-only** dashboard. It is not meant to be deployed: it runs on `127.0.0.1`, makes no network calls with your data, has **read-only** access to `~/.claude` / `~/.claude.json` and read-write access only to the project's own `data/` directory. Security reports are still very welcome — especially anything that could:

- escape the `CLAUDE_DIR` sandbox / bypass `safeResolve` (path traversal),
- write to `~/.claude` without the corresponding opt-in permission (`isAllowed`),
- leak sensitive fields from `~/.claude.json` (e.g. `env` values, OAuth secrets),
- turn a read-only route (search, export, MCP, plugins) into a write, or
- perform a destructive delete that bypasses the trash.

## Reporting a vulnerability

Please report vulnerabilities **privately** — do not open a public issue.

Open a [private security advisory](https://github.com/maximebgd/claudeboard/security/advisories/new) on GitHub. This keeps the report confidential until a fix is available.

Please include: affected version/commit, a description of the issue, steps to reproduce (a minimal fixture `~/.claude` helps), and the impact.

## What to expect

- Acknowledgement within a few days.
- An assessment and, if confirmed, a fix on `main` as soon as reasonably possible.
- Credit in the release notes if you'd like it (or anonymity if you prefer).

Thank you for helping keep claudeboard and its users safe.
