# claudeboard

Dashboard **local** (Next.js) pour visualiser et éditer la configuration Claude Code
stockée dans `~/.claude`. Il lit le système de fichiers de la machine — il n'est pas
destiné à être déployé : pas de télémétrie, pas d'auth, tourne uniquement en local.

## Ce que fait l'app

- **Dashboard / analytics** (page d'accueil) : agrège tous les transcripts JSONL en
  un seul passage (`lib/analytics.ts` → `getAnalytics`) pour afficher KPI (projets,
  sessions, messages, tokens, coût estimé), heatmap d'activité sur 12 mois,
  répartition des modèles (camembert `ModelDonut`), tokens & coût par modèle, coût par
  projet (`ProjectCostList`, recherche/tri côté client), distribution horaire des débuts
  de session (`HourlyDistribution` : 24 barres, heure **locale**, comptage brut par heure
  — pas une moyenne), outils/skills les plus utilisés (`ToolUsageList`), stats de session
  (moyennes, durées, ratio thinking/texte) et projets récents. Une carte d'abonnement (`SubscriptionCard`) compare le coût estimé de l'usage
  au prix du plan Claude (via `lib/subscription.ts`) pour afficher l'économie nette.
  Un sélecteur de fenêtre (`RangeSelector`) filtre les stats — `Tout` / `30 j` / `7 j`,
  un mois précis (`?range=month&month=YYYY-MM`) ou une plage libre
  (`?range=custom&from=…&to=…`) ; `getAnalytics(sinceMs, untilMs)` prend les deux bornes.
  La heatmap montre toujours l'historique complet (la fenêtre active y est surlignée).
  Chaque carte KPI concernée (Messages, Tokens, Coût estimé) affiche un delta de
  **vélocité** sous ses chiffres : la variation vs la période précédente de même durée
  (N vs N-1, `+/-% vs du … au …` avec les dates réelles de la période N-1) — masqué
  pour la fenêtre « Tout » (pas de période de comparaison).
- **Skills** : liste, aperçu et **édition** des `~/.claude/skills/*/SKILL.md`
  (frontmatter YAML + corps markdown). Toute écriture crée d'abord un backup
  horodaté `SKILL.md.bak.<timestamp>` à côté du fichier.
- **Projets & Sessions** : navigation **en lecture seule** dans
  `~/.claude/projects/*/*.jsonl` (transcripts de conversations). Chaque ligne JSONL
  est normalisée en blocs (`text`, `thinking`, `tool_use`, `tool_result`). La page d'un
  projet affiche aussi ses statistiques agrégées (`getProjectStats` dans `lib/analytics.ts` :
  modèles, tokens, coût estimé, top outils) au-dessus de la liste des sessions.
- **Config Claude** (section « Config » de la Sidebar) :
  - **Settings** : édition de `settings.json` et `settings.local.json` (JSON validé
    live + backup, création de `.local` à la demande) → `lib/configFiles.ts`.
  - **Hooks** : visualiseur **lecture seule** groupé par event (fusion des deux
    fichiers settings) → `lib/hooks.ts`.
  - **Agents** (`~/.claude/agents/*`) et **Commandes** (`~/.claude/commands/**`) :
    liste/aperçu/édition sur le modèle des skills (`lib/mdEntries.ts` ; les
    sous-dossiers de commands = namespaces).
  - **CLAUDE.md global** (`~/.claude/CLAUDE.md`) : éditeur markdown, création si absent.
  - **MCP servers** : **lecture seule** des serveurs de `~/.claude.json` (globaux +
    par projet) + statut d'auth (`lib/mcp.ts`) ; valeurs d'`env` masquées.
  - **Plugins & Marketplaces** : **lecture seule** des marketplaces connues et de leurs
    catalogues de plugins (`lib/plugins.ts`), avec KPI (marketplaces, plugins disponibles,
    installés, bloqués, total d'installs uniques communauté), plugins bloqués et compteurs
    d'usage. Affichage via `PluginCatalog`, qui propose sous chaque plugin la commande
    CLI `/plugin install|uninstall <nom>@<marketplace>` (copiable dans le presse-papier) ;
    l'installation elle-même reste du ressort du CLI (aucune écriture depuis l'app).
  - **Keybindings** (`~/.claude/keybindings.json`) : aperçu tabulaire + éditeur JSON,
    création si absent.
  - **Tarifs d'estimation** (`/config/pricing`) : tableau **lecture seule** des tarifs
    `PRICING` de `lib/analytics.ts` (in/out/cache), convention IN/OUT et formule de coût.
  - **Structure du dossier** (`/config/directory`) : arbre pédagogique (`DirectoryExplorer`)
    du contenu de `.claude/` (projet) et `~/.claude` (rôle, chargement, exemple par fichier) ;
    contenu statique, reproduit d'après la doc officielle.
- **Thème** : bascule clair/sombre (`ThemeToggle` dans la Sidebar), persistée dans
  `localStorage` et appliquée avant le premier rendu par un script inline dans
  `layout.tsx` (pas de flash).

## Stack

- Next.js 16 — App Router, React Server Components par défaut
- React 19, TypeScript (strict), alias d'import `@/*` → racine du repo
- Tailwind CSS v4 (via `@tailwindcss/postcss`, config dans `postcss.config.mjs` +
  `app/globals.css`, pas de `tailwind.config`)
- `gray-matter` (frontmatter), `react-markdown` + `remark-gfm` (rendu), `lucide-react` (icônes)
- UI en français

## Structure

```
lib/
  claude.ts    CLAUDE_DIR (override via env CLAUDE_DIR) · safeResolve (garde anti-
               traversée, tout doit rester dans CLAUDE_DIR) · formatDate/formatSize
  skills.ts    listSkills · getSkill · writeSkill (backup .bak avant écrasement)
  projects.ts  listProjects · listSessions · getSession · projectLabel ·
               normalisation des blocs JSONL
  analytics.ts getAnalytics(sinceMs, untilMs, prevSinceMs?, prevUntilMs?) : scan unique
               des JSONL → totaux, jours (heatmap), stats par modèle, top outils, coût
               par projet, durées, débuts de session par heure locale (`hours`, 24 seaux),
               totaux de la période précédente (`trend`, vélocité N vs N-1) ;
               getProjectStats(id) pour un projet ; parseModel + PRICING/MODEL_LABEL/
               MODEL_COLOR exportés (réutilisés par les pages pricing & donut)
  plugins.ts   getPlugins : LECTURE SEULE des marketplaces/plugins (~/.claude/plugins/ +
               catalogues à leur installLocation, usage dans ~/.claude.json, installs du
               plugin-catalog-cache.json) — jamais d'écriture, installation = CLI
  subscription.ts getSubscription : LECTURE SEULE du plan Claude via l'`oauthAccount` de
               ~/.claude.json (champs non sensibles only : type d'orga, facturation, date)
  configFiles.ts read/writeConfigFile : fichiers uniques (settings, settings.local,
               CLAUDE.md, keybindings) — JSON validé, backup si existant, création explicite
  mdEntries.ts list/get/writeMdEntry(kind) : agents & commandes (.md à frontmatter,
               slugs imbriqués = namespaces) ; même modèle que skills
  hooks.ts     getHooks : normalise les hooks des deux settings, groupés par event
  mcp.ts       getMcpServers : LECTURE SEULE de ~/.claude.json (hors CLAUDE_DIR), MCP
               globaux + par projet, statut via mcp-needs-auth-cache.json, env masqué
  keybindings.ts parseKeybindings : extraction défensive pour l'aperçu tabulaire
app/
  page.tsx                       Dashboard analytics (KPI, heatmap, modèles, coût par
                                 projet, outils, sessions, abonnement) + RangeSelector
  skills/page.tsx                Liste des skills
  skills/[name]/page.tsx         Détail + éditeur d'un skill
  projects/page.tsx              Liste des projets
  projects/[id]/page.tsx         Sessions d'un projet
  projects/[id]/[session]/page.tsx   Transcript d'une session
  config/settings/page.tsx       Éditeur settings.json + settings.local.json
  config/hooks/page.tsx          Visualiseur de hooks (lecture seule)
  config/agents/page.tsx · [...slug]/page.tsx   Liste + détail/éditeur d'agents
  config/commands/page.tsx · [...slug]/page.tsx Liste + détail/éditeur de commandes
  config/claude-md/page.tsx      Éditeur du CLAUDE.md global
  config/mcp/page.tsx            MCP servers (lecture seule)
  config/plugins/page.tsx        Plugins & Marketplaces (lecture seule)
  config/keybindings/page.tsx    Aperçu + éditeur des keybindings
  config/pricing/page.tsx        Tarifs d'estimation (tableau lecture seule)
  config/directory/page.tsx      Structure du dossier .claude (arbre pédagogique)
  api/skills/route.ts            POST { slug, raw } → écrit le SKILL.md (+ validations)
  api/config-file/route.ts       POST { target, raw } → fichiers uniques (JSON validé)
  api/md/route.ts                POST { kind, slug, raw } → agents/commandes (frontmatter validé)
  layout.tsx · globals.css · icon.svg
components/
  Sidebar · Markdown · Collapsible · ConfirmDialog · SkillEditor ·
  ConfigEditor (éditeur générique JSON/markdown : validation live, backup au save) ·
  MdEntryList · MdEntryDetail (liste/détail partagés agents & commandes) ·
  ActivityHeatmap (heatmap façon GitHub) · ThemeToggle (clair/sombre) ·
  ModelDonut (camembert modèles) · RangeSelector (fenêtre temporelle) ·
  SubscriptionCard (coût usage vs plan) · ProjectCostList · ToolUsageList ·
  HourlyDistribution (débuts de session par heure, heure locale) ·
  PluginCatalog (liste de plugins d'une marketplace) · DirectoryExplorer (arbre .claude) ·
  ReadOnlyBadge (marqueur « lecture seule »)
```

## Conventions importantes

- **Next 16** : dans les pages, `params` est une **Promise** — il faut `await params`
  avant de lire `id`/`name`/`session`. Consulte les guides dans
  `node_modules/next/dist/docs/` avant d'écrire du code (voir le bloc ci-dessous).
- Toutes les pages qui lisent le FS déclarent `export const dynamic = "force-dynamic"`
  (les données changent hors du cycle de build).
- **Sécurité** : tout accès fichier passe par `safeResolve(...)` pour empêcher une
  traversée de répertoire (`../`) via un slug/id d'URL. Les API `/api/skills` et
  `/api/md` refusent en plus les slugs de traversée et valident le frontmatter avant
  d'écrire ; `/api/config-file` n'accepte que des cibles whitelistées.
  - **Exceptions documentées** : `lib/mcp.ts`, `lib/subscription.ts` et `lib/plugins.ts`
    lisent `~/.claude.json`, qui est **hors de CLAUDE_DIR** et contient des secrets. Ce
    sont donc des accès **lecture seule** et **ciblés** — `mcp.ts` ne lit que `mcpServers`
    (valeurs d'`env` masquées), `subscription.ts` que des champs non sensibles de
    `oauthAccount`, `plugins.ts` que `pluginUsage`. De même, `plugins.ts` lit les
    `marketplace.json` à leur `installLocation`, qui peut pointer **hors de CLAUDE_DIR**
    (marketplace de type `directory`) — accès lecture seule, aucune écriture.
- L'écriture n'est jamais silencieuse : `writeSkill`/`writeMdEntry` vérifient que le
  fichier existe déjà (pas de création) et créent toujours un backup. Les créations de
  fichiers de config (`settings.local.json`, `keybindings.json`, `CLAUDE.md` global) via
  `writeConfigFile` sont explicites (flux « Créer » dans `ConfigEditor`).
- **Analytics** : le coût est une **estimation locale** (tarifs `PRICING` indicatifs
  par famille de modèle dans `lib/analytics.ts`, en USD/million de tokens), pas une
  facturation réelle. `getAnalytics` fait un seul passage sur tous les JSONL — garder
  l'agrégation dans cette fonction plutôt que de multiplier les scans du FS.

## Développement

```
npm run dev     # démarre le dashboard en local
npm run build   # build de production
npm run lint    # ESLint (next lint)
```

Pour pointer vers un répertoire Claude non standard (ou pour des tests) :
`CLAUDE_DIR=/chemin/.claude npm run dev`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
