---
title: Architecture
description: Stack technique, structure du code (lib / app / components) et conventions Next 16.
order: 2
---

# Architecture

## Stack

- **Next.js 16** — App Router, React Server Components par défaut.
- **React 19**, **TypeScript** (strict), alias d'import `@/*` → racine du repo.
- **Tailwind CSS v4** (via `@tailwindcss/postcss`, config dans `postcss.config.mjs` +
  `app/globals.css`, pas de `tailwind.config`).
- `gray-matter` (frontmatter), `react-markdown` + `remark-gfm` (rendu markdown),
  `lucide-react` (icônes).
- UI en français.

## Structure du code

### `lib/` — logique et accès fichiers

| Fichier | Rôle |
| --- | --- |
| `claude.ts` | `CLAUDE_DIR` (override via env), `safeResolve` (garde anti-traversée), helpers de format (date, taille, durée). |
| `skills.ts` | `listSkills` · `getSkill` · `writeSkill` (backup `.bak` avant écrasement). |
| `projects.ts` | `listProjects` · `listSessions` · `getSession` · normalisation des blocs JSONL. |
| `analytics.ts` | `getAnalytics(...)` : scan **unique** des JSONL → totaux, heatmap, stats par modèle, top outils, coût par projet, durées, débuts de session par heure, streak, vélocité N vs N-1. `getProjectStats(id)`, `getEffectivePricing()`, `PRICING`/`MODEL_LABEL`/`MODEL_COLOR`. |
| `store.ts` | État **propre à claudeboard** dans `data/claudeboard.json` (favoris, overrides de tarifs, abonnement, **permissions**, préférences d'affichage) — hors `CLAUDE_DIR`. `PERMISSION_SCHEMA`, `getPermissions`/`setPermissions`, `isAllowed(resource, action)`. |
| `trash.ts` | `moveToTrash` : suppression **réversible** (déplace vers `CLAUDE_DIR/.claudeboard-trash/`). |
| `favorites.ts` | `getFavoriteSessions` : résout les clés de favoris en métadonnées de session. |
| `plugins.ts` | `getPlugins` : lecture seule des marketplaces/plugins. |
| `subscription.ts` | `getSubscription` / `getEffectiveSubscription` : lecture seule du plan Claude (champs non sensibles) + choix manuel du store. |
| `configFiles.ts` | `read/writeConfigFile` + `resetConfigFile` + `deleteConfigFile` : settings, CLAUDE.md global, keybindings (JSON validé, backup, corbeille). |
| `mdEntries.ts` | `list/get/write/create/deleteMdEntry(kind)` : agents & commandes (frontmatter, namespaces). |
| `hooks.ts` | `getHooks` (groupés par event) · `getHooksRaw`/`writeHooks` (bloc hooks de `settings.json`). |
| `mcp.ts` | `getMcpServers` : lecture seule de `~/.claude.json` (env masqué). |
| `keybindings.ts` | `parseKeybindings` : extraction défensive pour l'aperçu tabulaire. |
| `docs.ts` | `listDocs` · `getDoc` : lit les `.md` de `docs/` pour la page `/docs`. |

> Principe clé de l'analytics : **un seul passage** sur tous les JSONL dans
> `getAnalytics`. On garde l'agrégation là plutôt que de multiplier les scans du FS.

### `app/` — routes (App Router)

Chaque écran est une route. La page d'accueil (`app/page.tsx`) est le dashboard
analytics ; `app/config/*` regroupe les éditeurs et références (dont `preferences`, qui
réunit permissions, tarifs, abonnement et affichage) ; `app/docs/*` rend cette
documentation. Les API vivent sous `app/api/*` : écritures gated (`skills`, `md`,
`config-file`, `hooks`, `projects`) et état claudeboard (`store`).

### `components/` — UI partagée

`Sidebar`, `Markdown`, `ConfigEditor` (éditeur générique JSON/markdown), les composants de
graphes (`ActivityHeatmap`, `ModelDonut`, `HourlyDistribution`…), `DocsNav`, etc.

## Conventions importantes

- **`params` est une `Promise`** (Next 16) : dans les pages, il faut `await params`
  avant de lire `id` / `name` / `slug` / `session`.
- Toutes les pages qui lisent le FS déclarent `export const dynamic = "force-dynamic"`
  (les données changent hors du cycle de build).
- **Écritures gated par permission** : toute mutation de `~/.claude` est conditionnée
  côté serveur par `isAllowed(resource, action)` (`lib/store.ts`). Défaut : tout `false`.
- **Ceci n'est pas le Next.js que vous connaissez** : cette version a des changements
  cassants. Le repo embarque un rappel (dans `AGENTS.md`) invitant à consulter les guides
  dans `node_modules/next/dist/docs/` avant d'écrire du code Next.

Voir aussi : [Sécurité](./securite.md) pour les gardes d'accès fichiers.
