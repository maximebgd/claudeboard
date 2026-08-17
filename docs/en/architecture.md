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
- UI in French.

## Code structure

### `lib/` — logic and file access

| File | Role |
| --- | --- |
| `claude.ts` | `CLAUDE_DIR` (override via env), `safeResolve` (path-traversal guard), format helpers (date, size, duration). |
| `skills.ts` | `listSkills` · `getSkill` · `writeSkill` (`.bak` backup before overwrite). |
| `projects.ts` | `listProjects` · `listSessions` · `getSession` · normalization of JSONL blocks. |
| `analytics.ts` | `getAnalytics(...)`: a **single** pass over the JSONL files → totals, heatmap, per-model stats, top tools, cost per project, durations, session starts per hour, streak, N vs N-1 velocity. `getProjectStats(id)`, `getEffectivePricing()`, `PRICING`/`MODEL_LABEL`/`MODEL_COLOR`. |
| `store.ts` | State **specific to claudeboard** in `data/claudeboard.json` (favorites, pricing overrides, subscription, **permissions**, display preferences) — outside `CLAUDE_DIR`. `PERMISSION_SCHEMA`, `getPermissions`/`setPermissions`, `isAllowed(resource, action)`. |
| `trash.ts` | `moveToTrash`: **reversible** deletion (moves to `CLAUDE_DIR/.claudeboard-trash/`). |
| `favorites.ts` | `getFavoriteSessions`: resolves favorite keys into session metadata. |
| `plugins.ts` | `getPlugins`: read-only view of marketplaces/plugins. |
| `subscription.ts` | `getSubscription` / `getEffectiveSubscription`: read-only view of the Claude plan (non-sensitive fields) + the store's manual choice. |
| `configFiles.ts` | `read/writeConfigFile` + `resetConfigFile` + `deleteConfigFile`: settings, global CLAUDE.md, keybindings (validated JSON, backup, trash). |
| `mdEntries.ts` | `list/get/write/create/deleteMdEntry(kind)`: agents & commands (frontmatter, namespaces). |
| `hooks.ts` | `getHooks` (grouped by event) · `getHooksRaw`/`writeHooks` (the `hooks` block of `settings.json`). |
| `mcp.ts` | `getMcpServers`: read-only view of `~/.claude.json` (`env` masked). |
| `keybindings.ts` | `parseKeybindings`: defensive extraction for the tabular preview. |
| `docs.ts` | `listDocs` · `getDoc`: reads the `.md` files in `docs/` for the `/docs` page. |

> Key analytics principle: **a single pass** over all the JSONL files in `getAnalytics`. We
> keep the aggregation there rather than multiplying FS scans.

### `app/` — routes (App Router)

Each screen is a route. The home page (`app/page.tsx`) is the analytics dashboard;
`app/config/*` groups the editors and references (including `preferences`, which bundles
permissions, pricing, subscription and display); `app/docs/*` renders this documentation.
The APIs live under `app/api/*`: gated writes (`skills`, `md`, `config-file`, `hooks`,
`projects`) and claudeboard state (`store`).

### `components/` — shared UI

`Sidebar`, `Markdown`, `ConfigEditor` (generic JSON/markdown editor), the chart components
(`ActivityHeatmap`, `ModelDonut`, `HourlyDistribution`…), `DocsNav`, etc.

## Important conventions

- **`params` is a `Promise`** (Next 16): in pages, you must `await params` before reading
  `id` / `name` / `slug` / `session`.
- Every page that reads the FS declares `export const dynamic = "force-dynamic"` (the data
  changes outside the build cycle).
- **Writes gated by permission**: any mutation of `~/.claude` is conditioned server-side by
  `isAllowed(resource, action)` (`lib/store.ts`). Default: everything `false`.
- **This is not the Next.js you know**: this version has breaking changes. The repo embeds a
  reminder (in `AGENTS.md`) inviting you to consult the guides in
  `node_modules/next/dist/docs/` before writing Next code.

See also: [Security](./securite.md) for the file-access guards.
