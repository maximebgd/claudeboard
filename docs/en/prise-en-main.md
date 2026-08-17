---
title: Getting started
description: What Claudeboard is, the prerequisites, installation and running it locally.
order: 1
---

# Getting started

**Claudeboard** is a **local** dashboard (Next.js) to visualize and edit the Claude Code
configuration stored in `~/.claude`. It reads your machine's file system directly.

> ⚠️ It is **not** meant to be deployed: no telemetry, no authentication, it runs only
> locally and reads your personal files.

> 🔒 **100% local — nothing ever leaves your machine.** claudeboard makes **no network
> calls** with your data: no telemetry, no analytics, no phone-home, no external API, no
> cloud. **Absolutely everything stays on your disk.** It only reads and writes local files
> under `~/.claude`, and the server is bound to `localhost`. The only network access is
> `npm install` (fetching dependencies) — never your transcripts, your config or your usage.

## Prerequisites

- **Node.js** (a recent version, compatible with Next.js 16) and **npm**.
- A `~/.claude` folder already populated by using Claude Code: this is where the session
  transcripts (`projects/*/*.jsonl`), skills, agents, commands and configuration files that
  the dashboard reads all live.

Without any history in `~/.claude`, the app works but most views will be empty.

## Installation

```bash
git clone <repo>
cd claudeboard
npm install
```

## Running

```bash
npm run dev      # starts the dashboard locally (http://localhost:3000)
```

Then open the URL shown in the terminal. The dashboard reads `~/.claude` on every request
(pages that touch the file system are `force-dynamic`), so your latest sessions show up
without a rebuild.

> 🔓 **The app starts read-only.** Any write to `~/.claude` (editing, creating, deleting)
> is **disabled by default**: explicitly open what you allow from **Preferences → Write
> permissions**. See [Security](./securite.md).

## Pointing at a different `.claude` folder

By default, the app reads `~/.claude`. To target a non-standard directory (or a test data
set), override the `CLAUDE_DIR` environment variable:

```bash
CLAUDE_DIR=/path/to/.claude npm run dev
```

## What next?

- [Architecture](./architecture.md) — how the code is organized.
- [Features](./fonctionnalites.md) — the full tour of the screens.
- [Security](./securite.md) — why reading your files stays scoped.
