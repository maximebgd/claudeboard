# claudeboard

Dashboard **local** (Next.js) pour visualiser et éditer la configuration Claude Code
stockée dans `~/.claude`. Il lit le système de fichiers de la machine — il n'est pas
destiné à être déployé : pas de télémétrie, pas d'auth, tourne uniquement en local.

## Ce que fait l'app

- **Dashboard / analytics** (page d'accueil) : agrège tous les transcripts JSONL en
  un seul passage (`lib/analytics.ts` → `getAnalytics`) pour afficher KPI (projets,
  sessions, messages, tokens, coût estimé), panneau d'activité (`ActivityPanel` : bascule
  entre heatmap façon GitHub et courbe des messages par jour, avec streak de jours
  consécutifs et panneau de détail du jour partagé `DayDetail`),
  répartition des modèles (camembert `ModelDonut`), tokens & coût par modèle, coût par
  projet (`ProjectCostList`, recherche/tri côté client), distribution horaire des débuts
  de session (`HourlyDistribution` : 24 barres, heure **locale**, comptage brut par heure
  — pas une moyenne), outils/skills les plus utilisés (`ToolUsageList`), stats de session
  (moyennes, durées, ratio thinking/texte) et projets récents. Une carte d'abonnement (`SubscriptionCard`) compare le coût estimé de l'usage
  au prix du plan Claude (via `lib/subscription.ts`) pour afficher l'économie nette.
  Un sélecteur de fenêtre (`RangeSelector`) filtre les stats — `Tout` / `30 j` / `7 j`,
  un mois précis (`?range=month&month=YYYY-MM`) ou une plage libre
  (`?range=custom&from=…&to=…`) ; `getAnalytics(sinceMs, untilMs)` prend les deux bornes.
  Les deux vues du panneau d'activité montrent toujours l'historique complet (la fenêtre
  active y est surlignée). Chaque carte KPI concernée (Messages, Tokens, Coût estimé)
  affiche un delta de **vélocité** sous ses chiffres : la variation vs la période
  précédente de même durée (N vs N-1, `+/-% vs du … au …` avec les dates réelles de la
  période N-1) — masqué pour la fenêtre « Tout » (pas de période de comparaison). Le
  dashboard liste aussi les **sessions épinglées** (favoris, cf. store local), chacune
  reliée à son transcript.
- **Skills** : liste, aperçu, **édition**, **création** (template pré-rempli) et
  **suppression** des `~/.claude/skills/*/SKILL.md` (frontmatter YAML + corps markdown).
  Toute écriture crée d'abord un backup horodaté `SKILL.md.bak.<timestamp>` à côté du
  fichier ; une suppression déplace le dossier en corbeille (`lib/trash.ts`). Chaque action
  (create/modify/delete) est **conditionnée par une permission** du store (cf. Préférences) —
  par défaut tout est verrouillé.
- **Projets & Sessions** : navigation **en lecture seule** dans
  `~/.claude/projects/*/*.jsonl` (transcripts de conversations). Chaque ligne JSONL
  est normalisée en blocs (`text`, `thinking`, `tool_use`, `tool_result`). La page d'un
  projet affiche aussi ses statistiques agrégées (`getProjectStats` dans `lib/analytics.ts` :
  modèles, tokens, coût estimé, top outils) au-dessus de la liste des sessions. Projets et
  sessions sont **épinglables** (`FavoriteButton` → store local) ; les projets épinglés
  remontent en tête de liste. La page d'une session propose un `ResumeButton` qui copie la
  commande `claude --resume <sessionId>` (l'app n'exécute rien, elle ne fait que la copier).
  La **suppression** d'un projet ou d'une session (déplacement en corbeille, via
  `/api/projects`) est possible si la permission `projects.delete` est activée.
- **Config Claude** (section « Config » de la Sidebar) :
  - **Préférences** (`/config/preferences`) : réglages **propres à claudeboard** (stockés
    dans `data/claudeboard.json`), regroupés en une page :
    - **Autorisations d'écriture** (`PermissionsMatrix`) : matrice ressource × action
      (create/modify/delete/reset) pilotant ce que l'app a le droit de faire dans `~/.claude`.
      **Tout `false` par défaut** (verrou opt-in intégral). Plugins & marketplaces en sont
      exclus (restent read-only). Cf. `PERMISSION_SCHEMA` dans `lib/store.ts`.
    - **Tarifs d'estimation** (`PricingEditor` → overrides par famille dans le store, défauts
      `PRICING` de `lib/analytics.ts`) + convention IN/OUT et formule de coût.
    - **Abonnement** (`SubscriptionSelector` : auto-détection depuis `~/.claude.json` ou plan
      manuel Pro / Max 5× / Max 20× / aucun) qui pilote l'estimation d'économie de la
      `SubscriptionCard`.
  - **Settings Claude** : édition de `settings.json` et `settings.local.json` (JSON validé
    live + backup, création de `.local` à la demande) → `lib/configFiles.ts`. Édition gated
    par `settings.modify` ; **réinitialisation** (`ResetButton`) par `settings.reset`.
  - **Hooks** : visualiseur groupé par event (fusion des deux fichiers settings) →
    `lib/hooks.ts`. **Édition** du bloc `hooks` de `settings.json` (`/api/hooks`,
    `getHooksRaw`/`writeHooks`) si `hooks.modify` est activé — create/modify/delete d'un
    hook = éditer ce JSON (une seule permission). `settings.local.json` n'est pas touché.
  - **Agents** (`~/.claude/agents/*`) et **Commandes** (`~/.claude/commands/**`) :
    liste/aperçu/édition/**création**/**suppression** sur le modèle des skills
    (`lib/mdEntries.ts` ; les sous-dossiers de commands = namespaces). Gated par
    `agents|commands.{create,modify,delete}`.
  - **CLAUDE.md global** (`~/.claude/CLAUDE.md`) : éditeur markdown, création si absent,
    **réinitialisation** et **suppression** (gated par `claudeMd.{create,modify,delete,reset}`).
  - **MCP servers** : **lecture seule** des serveurs de `~/.claude.json` (globaux +
    par projet) + statut d'auth (`lib/mcp.ts`) ; valeurs d'`env` masquées.
  - **Plugins & Marketplaces** : **lecture seule** des marketplaces connues et de leurs
    catalogues de plugins (`lib/plugins.ts`), avec KPI (marketplaces, plugins disponibles,
    installés, bloqués, total d'installs uniques communauté), plugins bloqués et compteurs
    d'usage. Affichage via `PluginCatalog`, qui propose sous chaque plugin la commande
    CLI `/plugin install|uninstall <nom>@<marketplace>` (copiable dans le presse-papier) ;
    l'installation elle-même reste du ressort du CLI (aucune écriture depuis l'app). **Pas
    de permission d'install/suppression** : volontairement hors du modèle d'autorisations.
  - **Keybindings** (`~/.claude/keybindings.json`) : aperçu tabulaire + éditeur JSON,
    création si absent, **réinitialisation** et **suppression** (gated par
    `keybindings.{create,modify,delete,reset}`).
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
               streak de jours consécutifs (`streak`), totaux de la période précédente
               (`trend`, vélocité N vs N-1) ; getProjectStats(id) pour un projet ;
               getEffectivePricing() = PRICING fusionné avec les overrides du store ;
               parseModel + PRICING/MODEL_LABEL/MODEL_COLOR exportés (pages pricing & donut)
  store.ts     état applicatif **de claudeboard** (favoris de sessions/projets, overrides
               de tarifs, plan d'abonnement, **permissions**) dans `data/claudeboard.json`
               — **hors** de CLAUDE_DIR (racine du projet, gitignored, override STORE_DIR) ;
               read/writeStore (écriture atomique, normalisation défensive), toggleFavorite,
               toggleFavoriteProject, setPricingOverrides, setSubscription ; `PERMISSION_SCHEMA`
               (ressource → actions), `getPermissions`/`setPermissions` (patch partiel) et
               `isAllowed(resource, action)` (garde serveur), migration de l'ancien `unlockedFields`
  trash.ts     moveToTrash : suppression **réversible** (déplace fichier/dossier vers
               `CLAUDE_DIR/.claudeboard-trash/`, horodaté) — utilisée par tous les delete
  favorites.ts getFavoriteSessions : résout les clés de favoris « <projectId>/<sessionId> »
               en métadonnées de session (marque les favoris orphelins `exists: false`)
  plugins.ts   getPlugins : LECTURE SEULE des marketplaces/plugins (~/.claude/plugins/ +
               catalogues à leur installLocation, usage dans ~/.claude.json, installs du
               plugin-catalog-cache.json) — jamais d'écriture, installation = CLI
  subscription.ts getSubscription : LECTURE SEULE du plan Claude via l'`oauthAccount` de
               ~/.claude.json (champs non sensibles only : type d'orga, facturation, date) ;
               getEffectiveSubscription() applique le choix manuel du store sinon l'auto ;
               PLANS / isManualPlan (validation des plans manuels) exportés
  configFiles.ts read/writeConfigFile : fichiers uniques (settings, settings.local,
               CLAUDE.md, keybindings) — JSON validé, backup si existant, création explicite ;
               resetConfigFile (restaure un défaut) · deleteConfigFile (→ corbeille)
  skills.ts    (rappel) listSkills · getSkill · writeSkill · createSkill · deleteSkill ·
               skillTemplate · isValidSkillSlug
  mdEntries.ts list/get/writeMdEntry(kind) : agents & commandes (.md à frontmatter,
               slugs imbriqués = namespaces) ; même modèle que skills + createMdEntry ·
               deleteMdEntry · mdTemplate · isValidMdSlug
  hooks.ts     getHooks : normalise les hooks des deux settings, groupés par event ;
               getHooksRaw/writeHooks : lecture/écriture du bloc hooks de settings.json
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
  config/preferences/page.tsx    Préférences claudeboard : permissions + tarifs + abonnement
  config/pricing/page.tsx        Redirection → /config/preferences (compat ancien lien)
  config/settings/page.tsx       Éditeur settings.json + settings.local.json (+ reset)
  config/hooks/page.tsx          Visualiseur de hooks + éditeur du bloc hooks (si autorisé)
  config/agents/page.tsx · [...slug]/page.tsx   Liste (+ création) + détail/éditeur/suppression d'agents
  config/commands/page.tsx · [...slug]/page.tsx Liste (+ création) + détail/éditeur/suppression de commandes
  config/claude-md/page.tsx      Éditeur du CLAUDE.md global (+ reset/suppression)
  config/mcp/page.tsx            MCP servers (lecture seule)
  config/plugins/page.tsx        Plugins & Marketplaces (lecture seule)
  config/keybindings/page.tsx    Aperçu + éditeur des keybindings (+ reset/suppression)
  config/directory/page.tsx      Structure du dossier .claude (arbre pédagogique)
  api/skills/route.ts            POST { op, slug, raw } → SKILL.md : write/create/delete (gated)
  api/config-file/route.ts       POST { op, target, raw } → fichiers uniques : write/reset/delete (gated)
  api/md/route.ts                POST { op, kind, slug, raw } → agents/commandes : write/create/delete (gated)
  api/projects/route.ts          POST { op:delete, scope, projectId, sessionId? } → corbeille (gated)
  api/hooks/route.ts             POST { raw } → écrit le bloc hooks de settings.json (gated)
  api/store/route.ts             POST { section, … } → état claudeboard (favoris, tarifs,
                                 abonnement, permissions) ; dispatch par section whitelistée → lib/store.ts
  layout.tsx · globals.css · icon.svg
components/
  Sidebar · Markdown · Collapsible · ConfirmDialog · SkillEditor ·
  ConfigEditor (éditeur générique JSON/markdown : validation live, backup au save, mode
  lecture seule via `canWrite` + bannière) ·
  PermissionsMatrix (matrice d'autorisations) · PermissionNotice (bannière « lecture seule ») ·
  DeleteButton · ResetButton · CreateEntryButton (actions gated, avec confirmation) ·
  MdEntryList · MdEntryDetail (liste/détail partagés agents & commandes) ·
  ActivityPanel (bascule heatmap/courbe + streak) · ActivityHeatmap (heatmap façon GitHub) ·
  TrendChart (courbe des messages par jour) · DayDetail (détail d'un jour, partagé) ·
  ThemeToggle (clair/sombre) · ModelDonut (camembert modèles) · RangeSelector (fenêtre
  temporelle) · SubscriptionCard (coût usage vs plan) · SubscriptionSelector (choix de plan) ·
  PricingEditor (édition des overrides de tarifs) · ProjectCostList · ToolUsageList ·
  HourlyDistribution (débuts de session par heure, heure locale) ·
  FavoriteButton (épinglage session/projet) · ResumeButton (copie `claude --resume`) ·
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
  `writeConfigFile` sont explicites (flux « Créer » dans `ConfigEditor`). Les
  **suppressions ne sont jamais destructives** : elles passent par `moveToTrash`
  (`lib/trash.ts`) qui déplace vers `CLAUDE_DIR/.claudeboard-trash/` (réversible).
- **Autorisations d'écriture (permissions)** : toute mutation de `~/.claude` est
  **conditionnée** par une permission du store (`PERMISSION_SCHEMA` dans `lib/store.ts`,
  ressource × action). Le contrôle d'accès est fait **côté serveur** dans chaque route API
  via `isAllowed(resource, action)` (403 sinon) — l'UI ne fait que refléter l'état (bouton
  masqué, bannière `PermissionNotice`). Ajouter une nouvelle action d'écriture ⇒ l'ajouter
  au schéma **et** la garder derrière `isAllowed`. Défaut : tout `false`.
- **État propre à claudeboard vs config Claude** : les données qui n'appartiennent pas à
  Claude Code (favoris, overrides de tarifs, choix d'abonnement, `permissions`) vivent
  dans `data/claudeboard.json` — **hors** de CLAUDE_DIR et de `~/.claude`, à la racine du
  projet (gitignored, écriture atomique via `lib/store.ts`). Ne jamais mélanger ces
  préférences d'UI avec les fichiers de `~/.claude`. L'API `/api/store` valide et dispatche
  par `section` whitelistée.
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
