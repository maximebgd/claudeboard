---
title: Features
description: The full tour of the screens — analytics dashboard, skills, projects & sessions, and the Claude config.
order: 3
---

# Features

## Dashboard / analytics (home page)

Aggregates all JSONL transcripts in a single pass (`lib/analytics.ts` → `getAnalytics`) to
display:

- **KPIs**: projects, sessions, messages, tokens, estimated cost.
- **Activity panel** (`ActivityPanel`): toggles between a 12-month **heatmap**
  (GitHub-style) and a **messages-per-day curve** (`TrendChart`), with a **streak** of
  consecutive days. Clicking a day opens a shared detail panel (`DayDetail`). Both views
  always show the full history, with the active window highlighted.
- **Model breakdown**: donut chart (`ModelDonut`) with IN/OUT messages on hover, tokens &
  cost per model.
- **Cost per project** (`ProjectCostList`) with client-side search/sort.
- **Hourly distribution** of session starts (`HourlyDistribution`: 24 bars, **local** time,
  raw count per hour).
- **Most-used tools / skills** (`ToolUsageList`).
- **Session stats**: averages, durations (active time, see [Metrics &
  estimation](./metriques.md)), thinking/text ratio, recent projects.
- **Pinned sessions**: favorites (see the local store), each linked to its transcript.
- **Subscription** (`SubscriptionCard`): compares the estimated usage cost to the price of
  the Claude plan (via `lib/subscription.ts`) to show the net savings (plan details revealed
  on card hover).

### Clickable "Estimated cost" card

The "Estimated cost" KPI card (`CostStatCard`) toggles on click between the **estimated
usage cost** and the **net savings** achieved through the subscription. The value shown by
default follows the `costCardMode` preference (see Preferences).

### Window selector (`RangeSelector`)

Filters the stats: `All` / `30 d` / `7 d`, a specific month (`?range=month&month=YYYY-MM`)
or a free range (`?range=custom&from=…&to=…`). `getAnalytics(sinceMs, untilMs)` takes both
bounds. Each relevant KPI card (Messages, Tokens, Cost) shows a **velocity delta**: the
change vs the previous period of the same length (N vs N-1, with the real dates of period
N-1) — hidden for the "All" window.

> The **cost is a local estimate** (indicative rates per model family), not real billing.
> Calculation details (cost **and** durations) in [Metrics & estimation](./metriques.md);
> rates editable in **Preferences → Estimation rates**.

## Write permissions

Any mutation of `~/.claude` is **conditioned by a permission** in the store
(resource × action: create / modify / delete / reset). **Everything is `false` by default**
(full opt-in lock): the app starts read-only and you explicitly open what you allow it to
write, from **Preferences → Write permissions** (`PermissionsMatrix`). The check is done
**server-side**; the UI only reflects the state (hidden button, "read-only" banner). Plugins
& marketplaces are excluded (they stay read-only). See also [Security](./securite.md).

## Skills

List, preview, **edit**, **create** (pre-filled template) and **delete** the
`~/.claude/skills/*/SKILL.md` files (YAML frontmatter + markdown body). Every write first
creates a **timestamped backup** `SKILL.md.bak.<timestamp>` next to the file; a deletion
moves the folder to the **trash** (reversible). Each action is gated by
`skills.{create,modify,delete}`.

## Projects & Sessions

**Read-only** navigation of `~/.claude/projects/*/*.jsonl` (transcripts). Each JSONL line is
normalized into blocks (`text`, `thinking`, `tool_use`, `tool_result`). A project's page
also shows its aggregated statistics (`getProjectStats`) above the list of sessions.

- **Pinning**: projects and sessions can be pinned (`FavoriteButton` → local store); pinned
  projects rise to the top of the list.
- **Resume**: a session's page offers a `ResumeButton` that **copies** the
  `claude --resume <sessionId>` command to the clipboard (the app runs nothing).
- **Export**: `ExportButton` downloads a session or a whole project as **Markdown** or
  **standalone HTML** (`/api/export`, read-only, outside permissions). The project export
  reproduces the site's rendering (KPIs, models, top tools, session list) as a standalone
  mini-site.
- **Deletion**: projects and sessions can be deleted (moved to the trash, via
  `/api/projects`) if the `projects.delete` permission is enabled.

## Full-text search

A **search** (`/search`, opened by the `SearchFab` visible on `/projects`) sweeps **read-only**
across all transcripts, streamed line by line, ignoring case and accents. It scans `text`
blocks by default (toggles for `thinking` and `tool_result`), groups results by session
(most recent first) and highlights the excerpts. Outside permissions.

## Claude config (the "Config" section)

- **Preferences** (`/config/preferences`): settings **specific to claudeboard**, grouped on
  a single page — **Write permissions** (`PermissionsMatrix`), **Estimation rates**
  (`PricingEditor`, overrides per family + cost formula), **Subscription**
  (`SubscriptionSelector`: auto-detection from `~/.claude.json` or manual plan Pro /
  Max 5× / Max 20×), **Display** (`CostModeSelector`: the default value of the "Estimated
  cost" card) and **Language** (`LanguageSelector`: FR / EN).
- **Settings**: editing `settings.json` and `settings.local.json` (JSON validated live +
  backup, `.local` created on demand); **reset** possible (`settings.reset`).
- **Hooks**: a viewer grouped by event (merging both settings files) **and editing** of the
  `hooks` block of `settings.json` if `hooks.modify` is enabled (`settings.local.json` is
  not touched).
- **Agents** (`~/.claude/agents/*`) and **Commands** (`~/.claude/commands/**`):
  list/preview/**edit**/**create**/**delete** on the same model as skills (command
  subfolders = namespaces).
- **Dependency graph** (`/config/graph`): **read-only** — who references whom among skills,
  agents and commands (textual detection: `/command`, `@agent`, name in backticks), with a
  client-side force-directed layout.
- **Global CLAUDE.md**: markdown editor, creation if absent, **reset** and **delete**.
- **MCP servers**: **read-only** view of the servers in `~/.claude.json` + auth status
  (`env` values masked).
- **Plugins & Marketplaces**: **read-only** view of marketplaces and catalogs, KPIs and
  blocked plugins; installation stays a CLI matter (`/plugin install …`, copyable command).
  Deliberately **outside** the permissions model.
- **Keybindings** (`~/.claude/keybindings.json`): tabular preview + JSON editor, creation if
  absent, **reset** and **delete**.
- **Trash** (`/config/trash`): items deleted from the app, stored **outside** `~/.claude`
  (`data/trash/`). Each entry is **restorable** (refused if the target already exists) or can
  be permanently deleted; the trash can be emptied. Restoration reuses the original
  resource's `delete` permission; emptying/permanent deletion is gated by `trash.empty`.
- **Folder structure**: an educational tree of the contents of `.claude/`.

All the write actions above are **gated** by the corresponding permission (see *Write
permissions*), and **deletions go through the trash** (reversible).

## Theme

Light/dark toggle (`ThemeToggle` in the Sidebar), persisted in `localStorage` and applied
before the first render (no flash).
