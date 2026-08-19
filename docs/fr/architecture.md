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
- UI **bilingue FR/EN** (i18n maison, défaut français ; cf. Conventions).

## Structure du code

### `lib/` — logique et accès fichiers

| Fichier | Rôle |
| --- | --- |
| `claude.ts` | `CLAUDE_DIR` (override via env), `safeResolve` (garde anti-traversée), helpers de format (date, taille, durée). |
| `skills.ts` | `listSkills` · `getSkill` · `writeSkill` (backup `.bak` avant écrasement) · `createSkill` · `deleteSkill` · `skillTemplate`. |
| `projects.ts` | `listProjects` · `listSessions` · `getSession` · normalisation des blocs JSONL. |
| `analytics.ts` | `getAnalytics(...)` : scan **unique** des JSONL → totaux, heatmap, stats par modèle, top outils, coût par projet, durées, débuts de session par heure, streak, vélocité N vs N-1. `getProjectStats(id)`, `getEffectivePricing()`, `PRICING`/`MODEL_LABEL`/`MODEL_COLOR`. |
| `store.ts` | État **propre à claudeboard** dans `data/claudeboard.json` (favoris, overrides de tarifs, abonnement, **permissions**, préférences dont **langue**) — hors `CLAUDE_DIR` (override `STORE_DIR`). `PERMISSION_SCHEMA`, `getPermissions`/`setPermissions`, `isAllowed(resource, action)`. |
| `trash.ts` | Corbeille **hors** de `CLAUDE_DIR` (`data/trash/<id>/`, override `TRASH_DIR`) : `moveToTrash` (suppression réversible, utilisée par tous les delete) · `listTrash` · `restoreTrash` · `deleteTrashEntry` · `emptyTrash`. |
| `favorites.ts` | `getFavoriteSessions` : résout les clés de favoris en métadonnées de session. |
| `mdEntries.ts` | `list/get/write/create/deleteMdEntry(kind)` : agents & commandes (frontmatter, namespaces). |
| `configFiles.ts` | `read/writeConfigFile` + `resetConfigFile` + `deleteConfigFile` : settings, CLAUDE.md global, keybindings (JSON validé, backup, corbeille). |
| `hooks.ts` | `getHooks` (groupés par event) · `getHooksRaw`/`writeHooks` (bloc hooks de `settings.json`). |
| `graph.ts` | `getDependencyGraph` : **lecture seule** — références croisées skills/agents/commandes → nœuds + liens dirigés (pour `/config/graph`). |
| `export.ts` | `sessionToMarkdown/Html` · `projectToMarkdown/Html` · `exportFilename` : rendu **lecture seule** en Markdown ou HTML autonome (servi par `/api/export`). |
| `search.ts` | `searchTranscripts` : full-text **lecture seule**, scan streamé ligne par ligne (casse/accents ignorés), extraits surlignés groupés par session. |
| `mcp.ts` | `getMcpServers` : lecture seule de `~/.claude.json` (env masqué). |
| `subscription.ts` | `getSubscription` / `getEffectiveSubscription` : lecture seule du plan Claude (champs non sensibles) + choix manuel du store. |
| `plugins.ts` | `getPlugins` : lecture seule des marketplaces/plugins. |
| `keybindings.ts` | `parseKeybindings` : extraction défensive pour l'aperçu tabulaire. |
| `rateLimits.ts` | `getRateLimits` : **lecture seule** des limites d'usage Claude.ai (fenêtres 5 h / 7 j) depuis le cache du statusline (`statusline-cache/rate-limits.env`) — `known:false` sans cache, valeurs hors temps réel. |
| `i18n.ts` | `getT()` (serveur) : lit la langue du store → `{ locale, t }`. |
| `i18n/core.ts` | `translate`/`tPlural` **isomorphes** (bundlables client) : interpolation `{var}`, pluriel. |
| `i18n/translations.ts` | dico plat pointé fr/en (l'anglais manquant est une **erreur de compilation**). |
| `docs.ts` | `listDocs` · `getDoc` : lit les `.md` de `docs/<langue>/` pour la page `/docs` (repli français). |

> Principe clé de l'analytics : **un seul passage** sur tous les JSONL dans
> `getAnalytics`. On garde l'agrégation là plutôt que de multiplier les scans du FS.

### `app/` — routes (App Router)

Chaque écran est une route. La page d'accueil (`app/page.tsx`) est le dashboard
analytics ; `app/search` est la recherche full-text ; `app/config/*` regroupe les éditeurs
et références (dont `preferences`, qui réunit permissions, tarifs, abonnement, affichage et
**langue** ; `graph`, le graphe de dépendances ; `trash`, la corbeille) ; `app/docs/*` rend
cette documentation. Les API vivent sous `app/api/*` : écritures gated (`skills`, `md`,
`config-file`, `hooks`, `projects`, `trash`), état claudeboard (`store`), et accès **lecture
seule** hors permissions (`export`, `search`).

### `components/` — UI partagée

`Sidebar`, `Markdown`, `ConfigEditor` (éditeur générique JSON/markdown), les composants de
graphes (`ActivityHeatmap`, `ModelDonut`, `HourlyDistribution`…), `DependencyGraph`,
`SearchView`/`SearchFab`, `ExportButton`, `TrashList`, `DocsNav`, et l'i18n client
(`I18nProvider`/`useTranslation`, `LanguageSelector`), etc.

## Conventions importantes

- **`params` est une `Promise`** (Next 16) : dans les pages, il faut `await params`
  avant de lire `id` / `name` / `slug` / `session`.
- Toutes les pages qui lisent le FS déclarent `export const dynamic = "force-dynamic"`
  (les données changent hors du cycle de build).
- **Écritures gated par permission** : toute mutation de `~/.claude` est conditionnée
  côté serveur par `isAllowed(resource, action)` (`lib/store.ts`). Défaut : tout `false`.
- **i18n (FR/EN)** : `lib/i18n/core.ts` est **isomorphe** (aucune lecture FS/store, reste
  bundlable client). Côté serveur, `await getT()` lit la langue du store ; côté client,
  `I18nProvider` (seedé par `layout.tsx`) expose `useTranslation()`. Toute nouvelle chaîne
  visible ⇒ une clé dans **fr et en** (`translations.ts`), l'anglais manquant étant une
  erreur de compilation.
- **Ceci n'est pas le Next.js que vous connaissez** : cette version a des changements
  cassants. Le repo embarque un rappel (dans `AGENTS.md`) invitant à consulter les guides
  dans `node_modules/next/dist/docs/` avant d'écrire du code Next.

Voir aussi : [Sécurité](./securite.md) pour les gardes d'accès fichiers.
