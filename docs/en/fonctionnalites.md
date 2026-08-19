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
- **Usage limits**: two bars in the header (rolling 5-hour and 7-day windows) — requires
  a statusline configuration, see below.

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

### Usage limits (5-hour / 7-day windows)

The dashboard header shows two bars: how much of your Claude.ai rolling **5-hour** and
**7-day** windows you have consumed, and the time left before they reset.

> ⚙️ **These bars require a statusline configuration.** Without it they simply do not
> appear — silently, with no error or message.

**Why a configuration?** Claude Code writes these percentages to no file at all: it only
passes them to the statusline script, inside the JSON it sends on standard input (the
`rate_limits` field). Claudeboard therefore cannot read them at the source. It reads a copy
that the statusline must drop on disk, at `~/.claude/statusline-cache/rate-limits.env`.

**How to do it.** Add this block to your `~/.claude/statusline-command.sh`. It assumes the
incoming JSON is already in an `input` variable (typically `input=$(cat)` at the top of the
script) and it needs `jq`:

```bash
# Usage-limits cache, read by claudeboard.
RATE_CACHE="$HOME/.claude/statusline-cache/rate-limits.env"
BLOCK_PCT=$(jq -r '.rate_limits.five_hour.used_percentage // -1 | floor' <<<"$input")
if [ "$BLOCK_PCT" -ge 0 ]; then
  mkdir -p "$(dirname "$RATE_CACHE")"
  jq -r '
    "BLOCK_PCT="        + (.rate_limits.five_hour.used_percentage  // -1 | floor | tostring),
    "RESET_EPOCH="      + (.rate_limits.five_hour.resets_at        //  0 | floor | tostring),
    "WEEK_PCT="         + (.rate_limits.seven_day.used_percentage  // -1 | floor | tostring),
    "WEEK_RESET_EPOCH=" + (.rate_limits.seven_day.resets_at        //  0 | floor | tostring)
  ' <<<"$input" > "$RATE_CACHE"
fi
```

The `if` is not decorative: `rate_limits` is only populated **after the first API exchange**
of a session. Early in a session the field is missing, the percentage is `-1`, and without
that guard you would overwrite a valid cache with empty values.

The resulting file is four `KEY=value` lines (reset dates are epochs in **seconds**):

```
BLOCK_PCT=92
RESET_EPOCH=1787150400
WEEK_PCT=34
WEEK_RESET_EPOCH=1787583600
```

Reload the page and the bars appear. If nothing changes, check that the file exists and
that `jq` is installed.

**What these bars actually show.** The percentages come from the **last reading** taken by
an active Claude Code session, not from right now: if you have not opened Claude Code for
two hours, they are two hours old. The countdown to the reset stays accurate, though, since
it is derived from the reset epoch. A window that has already rolled over is shown as
"reset", its consumption starting again from zero.

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
