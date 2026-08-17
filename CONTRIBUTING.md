# Contributing to claudeboard

<p align="center">
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/🇬🇧_English-2ea44f?style=for-the-badge" alt="English"></a>
  &nbsp;
  <a href="./CONTRIBUTING.fr.md"><img src="https://img.shields.io/badge/🇫🇷_Français-555555?style=for-the-badge" alt="Français"></a>
</p>

Thanks for taking the time to contribute! claudeboard is an independent, community project and contributions of all sizes are welcome — bug reports, docs, translations, and code.

> ℹ️ claudeboard is **not affiliated with Anthropic**. It is a local, read-mostly dashboard for the Claude Code config stored in `~/.claude`.

## Code of Conduct

This project follows our [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Please report unacceptable behavior privately — see the [Code of Conduct](./CODE_OF_CONDUCT.md#enforcement) for how.

## Ways to contribute

- **Report a bug** — open an [issue](https://github.com/maximebgd/claudeboard/issues) with clear steps to reproduce.
- **Suggest a feature** — open an issue describing the use case before writing code, so we can agree on the approach.
- **Improve the docs** — the `docs/` folder, the README (`README.md` / `README.fr.md`) and `AGENTS.md` all welcome fixes.
- **Add a translation** — the UI is bilingual (EN/FR); every user-facing string lives in `lib/i18n/translations.ts`.

## Getting started

Requirements: **Node.js 20+** and **npm**.

```bash
git clone https://github.com/maximebgd/claudeboard.git
cd claudeboard
npm install
npm run dev        # starts the dashboard on http://127.0.0.1:3000
```

The app reads the real `~/.claude` on your machine. To point it at a fixture directory instead (recommended while developing):

```bash
CLAUDE_DIR=/path/to/fixture/.claude npm run dev
```

Before opening a PR:

```bash
npm run lint       # ESLint (next lint)
npm run build      # production build — the source of truth for "does it work"
```

> Use `npm run build` to verify a change — **not** `npm run start`, which would occupy the port and collide with a running `npm run dev`.

## Project conventions

Please read [`AGENTS.md`](./AGENTS.md) first — it documents the architecture and the non-negotiable rules. The key ones:

- **Next.js 16 (App Router)** — `params` is a `Promise` (`await params` before reading it). Any page that touches the filesystem must declare `export const dynamic = "force-dynamic"`. Check the guides under `node_modules/next/dist/docs/` before writing framework code; this Next version has breaking changes.
- **Security first** — every filesystem access goes through `safeResolve(...)` (path-traversal guard, everything stays inside `CLAUDE_DIR`). The only exceptions are the documented **read-only** reads of `~/.claude.json` (`mcp.ts`, `subscription.ts`, `plugins.ts`).
- **Writes are never silent** — overwrites always create a timestamped `.bak` backup. Deletes are **never destructive**: they go through `moveToTrash` into `data/trash/` (outside `~/.claude`) and are restorable.
- **Permissions** — every mutation of `~/.claude` is gated server-side by `isAllowed(resource, action)` (403 otherwise). Adding a write action means adding it to `PERMISSION_SCHEMA` **and** keeping it behind `isAllowed`. Everything is `false` by default.
- **claudeboard state vs Claude config** — data that isn't Claude's (favorites, pricing, subscription, permissions, prefs) lives in `data/claudeboard.json`, never mixed with `~/.claude` files.
- **i18n (EN/FR)** — any new visible string needs a key in **both** `fr` and `en` in `lib/i18n/translations.ts`. A missing English translation is a **compile error**. Keep `lib/i18n/core.ts` isomorphic (no FS/store reads).

## Commits & pull requests

- Use **[Conventional Commits](https://www.conventionalcommits.org/)** for messages, e.g. `feat(search): highlight tool_result matches` or `fix(analytics): correct streak off-by-one`.
- Keep PRs focused: one logical change per PR. Rebase on `main` and make sure `npm run lint` and `npm run build` pass.
- Fill in the pull request template, describe **what** changed and **why**, and add screenshots for UI changes.
- Reference any related issue (`Closes #123`).

## Reporting security issues

Please do **not** open a public issue for security problems. See [`SECURITY.md`](./SECURITY.md) for how to report privately.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE) that covers the project.
