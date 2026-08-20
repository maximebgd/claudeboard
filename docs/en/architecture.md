---
title: Architecture
description: Technical stack, code structure (lib / app / components) and Next 16 conventions.
order: 2
---

# Architecture

## Stack

- **Next.js 16** — App Router, React Server Components by default.
- **React 19**, **TypeScript** (strict), import alias `@/*` → repo root.
- **Tailwind CSS v4** (via `@tailwindcss/postcss`, config in `postcss.config.mjs` +
  `app/globals.css`, no `tailwind.config`).
- `gray-matter` (frontmatter), `react-markdown` + `remark-gfm` (markdown rendering),
  `lucide-react` (icons).
- **Bilingual FR/EN** UI (in-house i18n, French default; see Conventions).

## Code structure

### `lib/` — logic and file access

| File | Role |
| --- | --- |
| `claude.ts` | `CLAUDE_DIR` (override via env), `safeResolve` (path-traversal guard), format helpers (date, size, duration). |
| `skills.ts` | `listSkills` · `getSkill` · `writeSkill` (previous version archived via `backups.ts`) · `createSkill` · `deleteSkill` · `skillTemplate`. |
| `projects.ts` | `listProjects` · `listSessions` · `getSession` · normalization of JSONL blocks. |
| `analytics.ts` | `getAnalytics(...)`: a **single** pass over the JSONL files → totals, heatmap, per-model stats, top tools, cost per project, durations, session starts per hour, streak, N vs N-1 velocity. `getProjectStats(id)`, `getEffectivePricing()`, `PRICING`/`MODEL_LABEL`/`MODEL_COLOR`. |
| `store.ts` | State **specific to claudeboard** in `data/claudeboard.json` (favorites, pricing overrides, subscription, **permissions**, preferences incl. **language**) — outside `CLAUDE_DIR` (`STORE_DIR` override). `PERMISSION_SCHEMA`, `getPermissions`/`setPermissions`, `isAllowed(resource, action)`. |
| `trash.ts` | Trash **outside** `CLAUDE_DIR` (`data/trash/<id>/`, `TRASH_DIR` override): `moveToTrash` (reversible deletion, used by every delete) · `listTrash` · `restoreTrash` · `deleteTrashEntry` · `emptyTrash`. |
| `favorites.ts` | `getFavoriteSessions`: resolves favorite keys into session metadata. |
| `mdEntries.ts` | `list/get/write/create/deleteMdEntry(kind)`: agents & commands (frontmatter, namespaces). |
| `configFiles.ts` | `read/writeConfigFile` + `resetConfigFile` + `deleteConfigFile`: settings, global CLAUDE.md, keybindings (validated JSON, previous version archived via `backups.ts`, deletion → trash). |
| `backups.ts` | Version history **outside** `CLAUDE_DIR` (`data/backups/<target>/`, `BACKUPS_DIR` override): `saveBackup` (called by `writeConfigFile`/`writeSkill`/`writeMdEntry`) · `listBackups` · `readBackup` · `deleteBackup`, capped to the N most recent versions. Restorable from the editor's **“Versions” panel**. |
| `diff.ts` | `unifiedDiff` **isomorphic** (LCS): two texts → unified `git diff`-style diff (for the Versions panel). |
| `hooks.ts` | `getHooks` (grouped by event) · `getHooksRaw`/`writeHooks` (the `hooks` block of `settings.json`). |
| `graph.ts` | `getDependencyGraph`: **read-only** — cross-references between skills/agents/commands → nodes + directed links (for `/config/graph`). |
| `export.ts` | `sessionToMarkdown/Html` · `projectToMarkdown/Html` · `exportFilename`: **read-only** rendering to Markdown or standalone HTML (served by `/api/export`). |
| `search.ts` | `searchTranscripts`: full-text **read-only**, streamed line-by-line scan (case/accents ignored), highlighted excerpts grouped by session. |
| `mcp.ts` | `getMcpServers`: read-only view of `~/.claude.json` (`env` masked). |
| `subscription.ts` | `getSubscription` / `getEffectiveSubscription`: read-only view of the Claude plan (non-sensitive fields) + the store's manual choice. |
| `billingCycle.ts` | `billingCycle` / `recentCycles`: **isomorphic** (no I/O) — billing-cycle bounds (the "Cycle" range) derived from the subscription's anniversary day, UTC-aligned and clamped for short months. |
| `plugins.ts` | `getPlugins`: read-only view of marketplaces/plugins. |
| `keybindings.ts` | `parseKeybindings`: defensive extraction for the tabular preview. |
| `rateLimits.ts` | `getRateLimits`: **read-only** Claude.ai usage limits (5-hour / 7-day windows) from the statusline cache (`statusline-cache/rate-limits.env`) — `known:false` without the cache, values are out of real time. |
| `i18n.ts` | `getT()` (server): reads the store language → `{ locale, t }`. |
| `i18n/core.ts` | `translate`/`tPlural`, **isomorphic** (client-bundlable): `{var}` interpolation, plurals. |
| `i18n/translations.ts` | flat dotted fr/en dictionary (a missing English string is a **compile error**). |
| `docs.ts` | `listDocs` · `getDoc`: reads the `.md` files in `docs/<lang>/` for the `/docs` page (French fallback). |

> Key analytics principle: **a single pass** over all the JSONL files in `getAnalytics`. We
> keep the aggregation there rather than multiplying FS scans.

### `app/` — routes (App Router)

Each screen is a route. The home page (`app/page.tsx`) is the analytics dashboard;
`app/search` is the full-text search; `app/config/*` groups the editors and references
(including `preferences`, which bundles permissions, pricing, subscription, display and
**language**; `graph`, the dependency graph; `trash`, the trash); `app/docs/*` renders this
documentation. The APIs live under `app/api/*`: gated writes (`skills`, `md`, `config-file`,
`hooks`, `projects`, `trash`, `backups` to restore/delete a version), claudeboard state
(`store`), and **read-only** access outside permissions (`export`, `search`).

### `components/` — shared UI

`Sidebar`, `Markdown`, `ConfigEditor` (generic JSON/markdown editor), the chart components
(`ActivityHeatmap`, `ModelDonut`, `HourlyDistribution`…), `DependencyGraph`,
`SearchView`/`SearchFab`, `ExportButton`, `TrashList`, `DocsNav`, and the client i18n
(`I18nProvider`/`useTranslation`, `LanguageSelector`), etc.

## Important conventions

- **`params` is a `Promise`** (Next 16): in pages, you must `await params` before reading
  `id` / `name` / `slug` / `session`.
- Every page that reads the FS declares `export const dynamic = "force-dynamic"` (the data
  changes outside the build cycle).
- **Writes gated by permission**: any mutation of `~/.claude` is conditioned server-side by
  `isAllowed(resource, action)` (`lib/store.ts`). Default: everything `false`.
- **i18n (FR/EN)**: `lib/i18n/core.ts` is **isomorphic** (no FS/store reads, stays
  client-bundlable). Server-side, `await getT()` reads the store language; client-side,
  `I18nProvider` (seeded by `layout.tsx`) exposes `useTranslation()`. Any new visible string
  ⇒ a key in **both fr and en** (`translations.ts`), a missing English string being a compile
  error.
- **This is not the Next.js you know**: this version has breaking changes. The repo embeds a
  reminder (in `AGENTS.md`) inviting you to consult the guides in
  `node_modules/next/dist/docs/` before writing Next code.

See also: [Security](./securite.md) for the file-access guards.
