---
title: Security
description: Opt-in permissions, path-traversal guard, writes are never silent (with backups), reversible deletions and scoped read-only access.
order: 5
---

# Security

Claudeboard reads — and sometimes writes — personal files on your machine. Four principles
frame these accesses.

> 🔒 **100% local — no data is sent anywhere.** claudeboard makes **no network calls** with
> your data: no telemetry, no analytics, no phone-home, no external API, no cloud.
> **Absolutely everything stays on your disk.** The server is bound to `localhost`; the
> project's only network access is `npm install` (dependencies) — never your transcripts,
> your config or your usage.

## 1. Opt-in write permissions

Any mutation of `~/.claude` is **conditioned by a permission** in the store
(`PERMISSION_SCHEMA` in `lib/store.ts`, resource × action). **Everything is `false` by
default**: the app starts fully read-only and you explicitly open, from **Preferences →
Write permissions**, what you allow it to do.

Access control is done **server-side** in each API route via `isAllowed(resource, action)`
(a `403` response otherwise). The UI only reflects the state (hidden button, "read-only"
banner) — hiding a button is never enough on its own. Plugins & marketplaces are
deliberately **outside** this model (read-only).

## 2. Path-traversal guard

Every file access goes through `safeResolve(...)` (`lib/claude.ts`) to prevent a directory
traversal (`../`) via a slug or id coming from a URL. The resolved path must **stay inside
`CLAUDE_DIR`**, otherwise an error is raised.

The write APIs add their own validations:

- `/api/skills` and `/api/md` reject traversal slugs **and** validate the frontmatter before
  writing.
- `/api/config-file` only accepts **whitelisted** targets.
- `/api/store` validates and dispatches by whitelisted `section` (favorites, pricing,
  subscription, permissions, preferences).

The `/docs` page reads `docs/` (in the repo, outside `~/.claude`): it therefore does not use
`safeResolve` but a dedicated slug guard (`^[a-z0-9-]+$`) in `lib/docs.ts`.

## 3. Writes are never silent — and deletions are reversible

- `writeSkill` / `writeMdEntry` check that the file **already exists** (no implicit
  creation) and **archive the previous version** before overwriting — **outside**
  `CLAUDE_DIR`, in `data/backups/` (`lib/backups.ts`), restorable from the editor's
  **“Versions” panel**.
- Config file creations (`settings.local.json`, `keybindings.json`, global `CLAUDE.md`) via
  `writeConfigFile` are **explicit** (the "Create" flow in `ConfigEditor`).
- **Deletions are never destructive**: they go through `moveToTrash` (`lib/trash.ts`), which
  moves the file/folder to `data/trash/<id>/` — **outside** `CLAUDE_DIR`, at the project root
  (`TRASH_DIR` override) — instead of erasing it. Each entry keeps a restoration `meta.json`,
  restorable or emptyable from `/config/trash` (emptying gated by `trash.empty`).

> **claudeboard-specific state vs Claude config.** The data that does not belong to Claude
> Code (favorites, pricing overrides, subscription choice, permissions, display preferences)
> lives in `data/claudeboard.json` — **outside** `CLAUDE_DIR` and `~/.claude`, at the project
> root (gitignored, atomic write via `lib/store.ts`).

## 4. Scoped read-only access (documented exceptions)

`lib/mcp.ts`, `lib/subscription.ts` and `lib/plugins.ts` read `~/.claude.json`, which is
**outside `CLAUDE_DIR`** and contains secrets. These accesses are **read-only** and
**targeted**:

- `mcp.ts` only reads `mcpServers` (`env` values **masked**);
- `subscription.ts` only reads **non-sensitive** fields of `oauthAccount`;
- `plugins.ts` only reads `pluginUsage` (and the `marketplace.json` files at their
  `installLocation`, which may point outside `CLAUDE_DIR` for a `directory`-type
  marketplace).

None of these functions write anything.

## In summary

The app is **local by design**: no telemetry, no auth, **no network transmission of your
data — absolutely everything stays on your machine**. It starts **read-only** (opt-in
permissions), every write creates a backup, and every deletion is reversible via the trash.
See also [Getting started](./prise-en-main.md).
