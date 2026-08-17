---
title: Development
description: npm scripts, how to verify a change, and reminders for contributing to the code.
order: 6
---

# Development

## Scripts

```bash
npm run dev      # starts the dashboard locally
npm run build    # production build
npm run lint     # ESLint (next lint)
```

To point at a non-standard Claude directory (or for testing):

```bash
CLAUDE_DIR=/path/.claude npm run dev
```

## Verifying a change

Use **`npm run build`** to check that a change compiles (strict TypeScript + ESLint). Do
**not** use `npm run start` during development: it conflicts with an already-running
`npm run dev`.

## Reminders for contributing

- **Next 16, `params` = `Promise`**: `await params` before reading `id`/`name`/`slug`.
- **`force-dynamic`** on any page that reads the file system.
- **This version of Next has breaking changes.** Consult the guides in
  `node_modules/next/dist/docs/` before writing Next code — the APIs and conventions may
  differ from what you know.
- **Security**: go through `safeResolve` for any access inside `CLAUDE_DIR`, validate URL
  inputs, and keep writes explicit with a backup (see [Security](./securite.md)).
- **Permissions**: any new write action must be added to `PERMISSION_SCHEMA` (`lib/store.ts`)
  **and** guarded server-side behind `isAllowed(resource, action)`. Do not mix
  claudeboard-specific state (`data/claudeboard.json`) with the files in `~/.claude`.
- **Deletions**: never destructive — go through `moveToTrash` (`lib/trash.ts`), which moves
  to `data/trash/` (outside `CLAUDE_DIR`).
- **i18n (FR/EN)**: any new visible string ⇒ a key in **both fr and en**
  (`lib/i18n/translations.ts`); a missing English string is a **compile error**. Keep
  `lib/i18n/core.ts` isomorphic (no FS/store reads).
- **Analytics**: keep the aggregation in the single pass of `getAnalytics` rather than
  multiplying FS scans.

## Updating this documentation

The `/docs` pages are the `.md` files in the `docs/<lang>/` folders (one variant per
language, e.g. `docs/fr/` and `docs/en/`). To add a page: create `docs/<lang>/<slug>.md`
with a `title` / `description` / `order` frontmatter. **French is the source of truth** (it
defines the full set of pages); a page without a translation automatically falls back to its
French version.
