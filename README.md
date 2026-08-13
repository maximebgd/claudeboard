# claudeboard

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/🇬🇧_English-2ea44f?style=for-the-badge" alt="English"></a>
  &nbsp;
  <a href="./README.fr.md"><img src="https://img.shields.io/badge/🇫🇷_Français-555555?style=for-the-badge" alt="Français"></a>
</p>

A **local** dashboard to analyze, browse and edit the Claude Code configuration stored in `~/.claude`.

Built with **Next.js 16** (App Router, React Server Components) and **React 19**. It reads the machine's filesystem directly — **it is not meant to be deployed**: no telemetry, no auth, runs on localhost only. The home page aggregates every conversation transcript in a **single pass** (`lib/analytics.ts` → `getAnalytics`) into KPIs, an activity heatmap, per-model token/cost breakdowns and estimated cost. Skills, agents, commands and config files are edited in place (every write creates a timestamped `.bak` backup first); projects, sessions, hooks, MCP servers and plugins are strictly **read-only**. Every filesystem access goes through a `safeResolve` guard that keeps paths inside `~/.claude` to prevent directory traversal from a URL slug.

> 🔒 **100% local — nothing ever leaves your machine.** claudeboard makes **zero network calls** with your data: no telemetry, no analytics, no phone-home, no external API, no cloud. **Absolutely everything stays on your disk.** It only reads and writes local files under `~/.claude`, and the server is bound to `localhost`. The sole network access is `npm install` (fetching dependencies) — never your transcripts, config or usage.

> ⚠️ **Not affiliated with Anthropic.** claudeboard is an independent, community project. It is not endorsed by or connected to Anthropic in any way — "Claude" is referenced only to describe what the tool reads.

> 💡 **Why this project?** Claude Code scatters its config across `~/.claude` — skills as `SKILL.md` files, conversation transcripts as raw `.jsonl`, settings, hooks, agents, plugins. claudeboard turns that opaque directory into a browsable, editable dashboard — with real usage analytics — without ever leaving your machine.

> 📥 **Data source.** The transcripts read by claudeboard come **only** from Claude Code itself: the **CLI** (`entrypoint: cli`) and the **VS Code extension** (`entrypoint: claude-vscode`), both of which write to `~/.claude/projects/*/*.jsonl`. Nothing else is included — not claude.ai (web), not the Claude Desktop app, not raw API usage.

![claudeboard screenshot](public/screenshot.png)

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 — App Router, RSC by default, `force-dynamic` FS pages |
| UI | React 19, TypeScript (strict), import alias `@/*` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`, no `tailwind.config`) |
| Frontmatter | `gray-matter` (YAML parse/serialize) |
| Markdown | `react-markdown` + `remark-gfm` |
| Icons | `lucide-react` |

## Structure

```
claudeboard/
├── lib/
│   ├── claude.ts          # CLAUDE_DIR + safeResolve (traversal guard) + date/size/duration formatters
│   ├── analytics.ts       # getAnalytics: single JSONL pass → totals, heatmap, per-model tokens/cost,
│   │                       #   top tools, cost per project, session hours, N-vs-N-1 velocity · PRICING
│   ├── skills.ts          # listSkills · getSkill · writeSkill (.bak backup before overwrite)
│   ├── projects.ts        # listProjects · listSessions · getSession · JSONL block normalization
│   ├── mdEntries.ts       # agents & commands (.md frontmatter, nested slugs = namespaces)
│   ├── configFiles.ts     # read/writeConfigFile: settings, CLAUDE.md, keybindings (JSON-validated, backup)
│   ├── hooks.ts           # getHooks: hooks from both settings files, grouped by event (read-only)
│   ├── mcp.ts             # getMcpServers: read-only ~/.claude.json, env values masked
│   ├── plugins.ts         # getPlugins: read-only marketplaces/plugins catalog
│   ├── subscription.ts    # getSubscription: read-only Claude plan (non-sensitive fields)
│   ├── keybindings.ts     # parseKeybindings: defensive extraction for the table preview
│   └── docs.ts            # listDocs · getDoc: renders the .md files under docs/ on /docs
├── app/
│   ├── page.tsx           # Analytics dashboard (KPIs, heatmap, models, cost, RangeSelector)
│   ├── skills/            # list · [name] (detail + editor)
│   ├── projects/          # list · [id] (sessions) · [id]/[session] (transcript)
│   ├── config/            # settings · hooks · claude-md · agents · commands · mcp ·
│   │                       #   plugins · keybindings · pricing · directory
│   ├── docs/              # layout · page · [slug] (renders docs/*.md)
│   ├── api/               # skills · config-file · md (POST write endpoints, validated)
│   └── layout.tsx · globals.css · icon.svg
├── components/            # Sidebar · Markdown · ConfigEditor · ActivityHeatmap · ModelDonut ·
│                           #   RangeSelector · SubscriptionCard · HourlyDistribution · DocsNav · …
├── docs/                  # bilingual project docs (.md) — same source rendered on /docs
└── AGENTS.md              # project instructions (aliased by CLAUDE.md)
```

## Features

- **Analytics dashboard (`/`)** — aggregates every JSONL transcript in one pass: KPIs (projects, sessions, messages, tokens, estimated cost), a 12-month **activity heatmap**, a model donut (`ModelDonut`) with IN/OUT counts, tokens & cost per model, cost per project, an hourly distribution of session starts (local time), most-used tools/skills, and session stats. A `RangeSelector` filters the window (all / 30d / 7d / a given month / a custom range); the relevant KPIs show a **velocity delta** vs the previous period of equal length (N vs N-1). A `SubscriptionCard` compares estimated usage cost against your Claude plan price.
- **Skills (`/skills`)** — list, preview and **edit** each `~/.claude/skills/*/SKILL.md` (YAML frontmatter + markdown body). Every save writes a timestamped `SKILL.md.bak.<timestamp>` before overwriting.
- **Projects & Sessions (`/projects`)** — **read-only** navigation of `~/.claude/projects/*/*.jsonl` transcripts, each line normalized into `text`, `thinking`, `tool_use` and `tool_result` blocks. A project page also shows its aggregated stats (`getProjectStats`).
- **Config (`/config/*`)** — **Settings** (edit `settings.json` / `settings.local.json`, live-validated JSON + backup), **Hooks** (read-only, grouped by event), **Agents** & **Commands** (list/preview/edit, nested folders = namespaces), **global CLAUDE.md** editor, **MCP servers** (read-only, `env` masked), **Plugins & Marketplaces** (read-only, install stays in the CLI), **Keybindings** (table + JSON editor), **Pricing** (estimation rates table) and **Directory** (educational `.claude` tree).
- **Documentation (`/docs`)** — renders the `.md` files under `docs/` with a side table of contents, so the project docs are readable both on GitHub and in the app.
- **Theme** — light/dark toggle, persisted in `localStorage` and applied before first paint (no flash).

## Environment variables

The app needs no configuration to run. Copy `.env.example` to `.env` if you want to override the default. A single optional variable lets you point it at a non-standard Claude directory (useful for tests):

| Variable | Default | Description |
|---|---|---|
| `CLAUDE_DIR` | `~/.claude` | Root of the Claude Code config to read/edit. Everything is sandboxed under this path. |

> 🔒 **Threat model.** claudeboard reads and writes your local filesystem with no authentication. It is a **localhost-only** tool — do not expose it on a network or deploy it. Path traversal from URL slugs is blocked by `safeResolve` (everything must resolve inside `CLAUDE_DIR`), and the write APIs additionally reject traversal slugs and validate frontmatter/JSON before writing. `lib/mcp.ts`, `lib/subscription.ts` and `lib/plugins.ts` read `~/.claude.json` (which lives outside `CLAUDE_DIR` and holds secrets) in a **targeted, read-only** way only — `env` values are masked and never written.

## Development

```bash
npm install
npm run dev        # start the dashboard on localhost
```

Point it at a non-standard Claude directory (or for tests):

```bash
CLAUDE_DIR=/path/.claude npm run dev
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint (next lint)
```

## Architecture

- **Reads** — `getAnalytics` scans all JSONL transcripts in a **single pass** to build every dashboard figure; the config/skills/projects libs read `~/.claude` on demand. All pages that touch the FS declare `export const dynamic = "force-dynamic"` since the data changes outside the build cycle.
- **Writes** — only skills, agents, commands and config files are writable, through `POST /api/skills`, `/api/md` and `/api/config-file`. `writeSkill`/`writeMdEntry` refuse to create a new file (it must already exist) and always copy it to a timestamped `.bak` before overwriting; config-file creation (`settings.local.json`, `keybindings.json`, global `CLAUDE.md`) is explicit.
- **Safety** — every path inside `CLAUDE_DIR` is built with `safeResolve(...)`, which throws if the result escapes it. The read-only reads of `~/.claude.json` (`mcp.ts`, `subscription.ts`, `plugins.ts`) are the documented exceptions, scoped to non-sensitive fields.
- **Next 16 note** — in pages, `params` is a **Promise** and must be `await`ed before reading `id`/`name`/`slug`/`session`.

## Schema

```mermaid
flowchart TD
    subgraph CLIENT["Client (browser)"]
      UI["Dashboard · editors · RangeSelector"]
    end
    subgraph SERVER["Next.js 16 server"]
      PAGES["RSC pages (force-dynamic)"]
      API["POST /api/skills · /api/md · /api/config-file"]
      ANALYTICS["analytics.ts — single JSONL pass"]
      LIB["lib: skills · projects · configFiles · mdEntries · …"]
      GUARD["safeResolve — traversal guard"]
    end
    subgraph FS["~/.claude (filesystem)"]
      TRANSCRIPTS["projects/*/*.jsonl"]
      SKILLS["skills · agents · commands · settings"]
      BAK["*.bak.&lt;ts&gt;"]
    end
    subgraph EXT["~/.claude.json (outside CLAUDE_DIR)"]
      MCP["mcpServers · pluginUsage · oauthAccount"]
    end

    UI -->|navigate| PAGES
    UI -->|save| API
    PAGES --> ANALYTICS
    PAGES --> LIB
    API --> LIB
    ANALYTICS -->|read-only| TRANSCRIPTS
    LIB --> GUARD
    GUARD -->|read| SKILLS
    GUARD -->|backup then write| SKILLS
    GUARD -.->|backup| BAK
    LIB -.->|read-only, masked| MCP

    style CLIENT fill:#1e293b,color:#fff
    style SERVER fill:#0f766e,color:#fff
    style FS fill:#7c2d12,color:#fff
    style EXT fill:#3f3f46,color:#fff
```
