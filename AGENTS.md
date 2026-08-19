# claudeboard

Dashboard **local** (Next.js) pour visualiser et éditer la configuration Claude Code
stockée dans `~/.claude`. Il lit le système de fichiers de la machine — il n'est pas
destiné à être déployé : pas de télémétrie, pas d'auth, tourne uniquement en local.

## Ce que fait l'app

Chaque fichier `lib/` et route `app/` est décrit dans **Structure** ci-dessous ; cette
section ne donne que le panorama fonctionnel.

- **Dashboard / analytics** (page d'accueil) : `getAnalytics` agrège tous les transcripts
  JSONL en un seul passage → KPI (projets, sessions, messages, tokens, coût estimé),
  panneau d'activité (heatmap GitHub ⇆ courbe des messages/jour + streak), répartition et
  coût par modèle, coût par projet, distribution horaire des débuts de session (heure
  **locale**), top outils/skills, stats de session et projets récents. Un `RangeSelector`
  filtre les stats (`Tout` / `30 j` / `7 j`, un mois `?range=month&month=YYYY-MM`, ou une
  plage libre `?range=custom&from&to`) ; les cartes Messages/Tokens/Coût affichent un delta
  de **vélocité** vs la période précédente de même durée (masqué en fenêtre « Tout »). La
  `SubscriptionCard` compare le coût d'usage au prix du plan pour estimer l'économie ; la
  carte KPI « Coût estimé » (`CostStatCard`) est **cliquable** (coût d'usage ⇆ économie),
  sa valeur par défaut suivant la préférence `costCardMode`. Un `UsageBanner` (en tête,
  à gauche du `RangeSelector`) affiche les **limites d'usage Claude.ai** (fenêtres
  glissantes 5 h / 7 j : % consommé + compte à rebours de reset), lues **hors temps réel**
  du cache du statusline (`rateLimits.ts`, lecture seule). ⚠️ Cette feature **suppose que le
  statusline de Claude Code est configuré pour écrire** ces limites dans le fichier de cache
  (`~/.claude/statusline-cache/rate-limits.env`, clés `BLOCK_PCT`/`RESET_EPOCH` +
  `WEEK_PCT`/`WEEK_RESET_EPOCH`) : Claude Code n'expose `rate_limits` qu'au statusline, jamais
  dans un fichier « officiel ». **Sans ce cache** (`known:false`), le bandeau reste affiché
  mais avec des jauges **vides** + une alerte cliquable renvoyant vers la doc de configuration
  (lien **ancré** vers la section, cf. `usage.docsAnchor` par langue). Le dashboard liste
  aussi les **sessions épinglées** (favoris).
- **Skills** : liste/aperçu/**édition**/**création** (template)/**suppression** des
  `~/.claude/skills/*/SKILL.md`. Écriture → version précédente archivée **hors** de
  `~/.claude` (panneau **Versions** restaurable, cf. `backups.ts`) ; suppression →
  corbeille. Chaque action est gated par une permission (cf. Préférences).
- **Projets & Sessions** : navigation **lecture seule** dans `~/.claude/projects/*/*.jsonl`
  (chaque ligne normalisée en blocs `text`/`thinking`/`tool_use`/`tool_result`). La page
  projet affiche ses stats agrégées (`getProjectStats`). Projets/sessions **épinglables**
  (les projets épinglés remontent). `ResumeButton` copie `claude --resume <sessionId>`
  (l'app n'exécute rien). `ExportButton` télécharge la session ou le projet en Markdown /
  HTML autonome (`/api/export`, hors permissions). La **suppression** projet/session
  (→ corbeille) est gated par `projects.delete`.
- **Recherche** (`/search`, ouverte par le `SearchFab` visible seulement sur `/projects`) :
  full-text **lecture seule** sur tous les transcripts, scan streamé ligne par ligne, casse
  et accents ignorés. Scanne les blocs `text` par défaut (toggles thinking / tool_result) ;
  résultats groupés par session, extraits surlignés. Hors permissions.
- **Config Claude** (section « Config » de la Sidebar) :
  - **Préférences** (`/config/preferences`) : réglages **propres à claudeboard**
    (`data/claudeboard.json`) — **Autorisations d'écriture** (`PermissionsMatrix`, tout
    `false` par défaut ; plugins/marketplaces exclus), **Tarifs d'estimation**
    (`PricingEditor`), **Abonnement** (`SubscriptionSelector` : auto depuis `~/.claude.json`
    ou plan manuel), **Affichage** (`CostModeSelector` → `costCardMode`), **Langue**
    (`LanguageSelector` → `language`, FR/EN).
  - **Settings Claude** : édition de `settings.json` / `settings.local.json` (JSON validé
    live, création `.local` à la demande). Gated par `settings.modify` ; reset par
    `settings.reset`. Chaque save archive la version précédente dans un panneau **Versions**
    (`BackupsPanel`, historique restaurable, cf. `backups.ts`).
  - **Hooks** : visualiseur groupé par event (fusion des deux settings). Édition du bloc
    `hooks` de `settings.json` gated par `hooks.modify` (`settings.local.json` non touché).
    Même panneau **Versions** de `settings.json` (restauration gated par `settings.modify`).
  - **Agents** (`~/.claude/agents/*`) & **Commandes** (`~/.claude/commands/**`, sous-dossiers
    = namespaces) : liste/aperçu/édition/création/suppression sur le modèle des skills. Gated
    par `agents|commands.{create,modify,delete}`.
  - **Graphe de dépendances** (`/config/graph`) : qui référence qui entre skills/agents/
    commandes (détection textuelle : `/commande`, `@agent`, nom en backticks) ; layout
    force-dirigé client. **Lecture seule**.
  - **CLAUDE.md global** (`~/.claude/CLAUDE.md`) : éditeur markdown, création/reset/
    suppression gated par `claudeMd.{create,modify,delete,reset}`. Panneau **Versions**
    (restauration gated par `claudeMd.modify`).
  - **MCP servers** : **lecture seule** des serveurs de `~/.claude.json` (globaux + par
    projet) + statut d'auth ; `env` masqué.
  - **Plugins & Marketplaces** : **lecture seule** des marketplaces et catalogues + KPI ;
    la commande CLI `/plugin install|uninstall` est copiable mais jamais exécutée. **Hors
    permissions** (l'install reste du ressort du CLI).
  - **Keybindings** (`~/.claude/keybindings.json`) : aperçu tabulaire + éditeur JSON,
    création/reset/suppression gated par `keybindings.{create,modify,delete,reset}`. Panneau
    **Versions** (restauration gated par `keybindings.modify`).
  - **Corbeille** (`/config/trash`) : éléments supprimés depuis l'app, stockés **hors** de
    `~/.claude` (`data/trash/`). Restaurable (refus si la cible existe) ou supprimable
    définitivement ; la corbeille peut être vidée. Restauration gated par le `delete` de la
    ressource d'origine ; vidage/suppression définitive par `trash.empty`.
  - **Structure du dossier** (`/docs/structure`) : arbre pédagogique statique de `.claude/`
    et `~/.claude` (rôle, chargement, exemple par fichier).
- **Documentation** (`/docs`) : rend les `.md` du dossier `docs/` (frontmatter
  `title`/`description`/`order`) avec sommaire latéral ; les titres sont
  **auto-ancrés** (`Markdown` dérive un `id` slugifié → liens profonds vers une section).
- **Thème** : bascule clair/sombre persistée dans `localStorage`, appliquée avant le
  premier rendu par un script inline dans `layout.tsx` (pas de flash).

## Stack

- Next.js 16 (App Router, RSC par défaut), React 19, TypeScript strict, alias `@/*` → racine
- Tailwind CSS v4 (via `@tailwindcss/postcss` + `app/globals.css`, pas de `tailwind.config`)
- `gray-matter` (frontmatter), `react-markdown` + `remark-gfm` (rendu), `lucide-react` (icônes)
- UI **bilingue FR/EN** (i18n maison, cf. Conventions ; défaut français)

## Structure

```
lib/
  claude.ts    CLAUDE_DIR (override env CLAUDE_DIR) · safeResolve (garde anti-traversée,
               tout reste dans CLAUDE_DIR) · formatDate/formatSize (date & taille localisées)
  format.ts    makeFormatters(locale) : fabrique de formatteurs **sensibles à la locale**
               (`num` compact au-delà de 10 000 · `usd` · `int`) — pas de `Intl.NumberFormat`
               en portée module (figerait la langue) : serveur = après `await getT()`, client
               = `useMemo(makeFormatters, [locale])`. Formatage nombre/monnaie (≠ date/taille)
  projects.ts  listProjects · listSessions · getSession · projectLabel · normalisation JSONL
  analytics.ts getAnalytics(sinceMs, untilMs, prevSinceMs?, prevUntilMs?) : scan unique des
               JSONL → totaux, jours (heatmap), stats/modèle, top outils, coût/projet,
               durées, débuts de session par heure locale, streak, période précédente
               (vélocité N vs N-1) ; getProjectStats(id) ; getEffectivePricing() = PRICING +
               overrides du store ; parseModel + PRICING/MODEL_LABEL/MODEL_COLOR exportés
  store.ts     état **de claudeboard** (favoris, overrides de tarifs, plan d'abonnement,
               permissions, préférences) dans `data/claudeboard.json` — **hors** de
               CLAUDE_DIR (override STORE_DIR) ; read/writeStore atomique · toggleFavorite(
               Project) · setPricingOverrides · setSubscription · get/setPreferences ;
               PERMISSION_SCHEMA (ressource → actions) · getPermissions/setPermissions ·
               isAllowed(resource, action) (garde serveur)
  trash.ts     corbeille **de claudeboard** hors de CLAUDE_DIR (`data/trash/<id>/`, override
               TRASH_DIR) : moveToTrash (suppression réversible, utilisée par tous les
               delete) · listTrash · restoreTrash (refus si la cible existe) · deleteTrashEntry
               · emptyTrash ; déplacement inter-volumes robuste (rename, repli copie+rm)
  favorites.ts getFavoriteSessions : résout « <projectId>/<sessionId> » en métadonnées
               (favoris orphelins marqués `exists: false`)
  skills.ts    listSkills · getSkill · writeSkill (version précédente archivée via
               backups.ts, clé `skills/<slug>`) · createSkill · deleteSkill · skillTemplate ·
               isValidSkillSlug
  mdEntries.ts list/get/writeMdEntry(kind) + create/deleteMdEntry · mdTemplate ·
               isValidMdSlug : agents & commandes (.md à frontmatter, slugs imbriqués =
               namespaces), même modèle que skills (version archivée via backups.ts, clé
               `<kind>/<slug>`)
  configFiles.ts read/writeConfigFile (settings, settings.local, CLAUDE.md, keybindings :
               JSON validé, version précédente archivée via backups.ts si existant, création
               explicite) · configResource (cible → ressource de permission) · resetConfigFile ·
               deleteConfigFile (→ corbeille)
  backups.ts   historique de versions **de claudeboard** hors de CLAUDE_DIR (`data/backups/
               <target>/<id>`, override BACKUPS_DIR ; `<target>` = cible de config OU chemin
               d'entrée imbriqué `skills|agents|commands/<slug>`, garde anti-traversée) :
               saveBackup (appelé par writeConfigFile/writeSkill/writeMdEntry, remplace les
               anciens `.bak.<ts>`) · listBackups (marque `current` la version identique au
               fichier actuel) · readBackup · deleteBackup (suppression définitive d'une
               version) · plafonné aux N versions récentes par cible. Restaurable ou
               supprimable depuis le panneau Versions de l'éditeur
  hooks.ts     getHooks (normalise/groupe les hooks des deux settings) · getHooksRaw/
               writeHooks (bloc hooks de settings.json)
  graph.ts     getDependencyGraph : LECTURE SEULE — références croisées skills/agents/
               commandes → nœuds + liens dirigés + compteurs (pour /config/graph)
  export.ts    sessionToMarkdown/Html · projectToMarkdown/Html · exportFilename : rendu
               LECTURE SEULE en Markdown ou HTML autonome (CSS embarqué). L'export projet
               reprend le rendu du site (KPI, modèles, top outils, liste de sessions) en
               mini-site autonome (routeur hash JS). Servi par /api/export
  search.ts    searchTranscripts : full-text LECTURE SEULE, scan streamé (readline) ; `fold`
               (minuscule + accents ôtés, longueur préservée → index alignés) + extraits
               surlignables, groupés par session (récents d'abord, plafonnés à 100)
  docs.ts      listDocs · getDoc : lit les `.md` de `docs/` (hors CLAUDE_DIR, garde-fou dédié)
  keybindings.ts parseKeybindings : extraction défensive pour l'aperçu tabulaire
  rateLimits.ts getRateLimits : LECTURE SEULE des limites d'usage Claude.ai (fenêtres 5 h /
               7 j) depuis le cache du statusline (`statusline-cache/rate-limits.env` dans
               CLAUDE_DIR → `safeResolve`). Claude Code ne persiste ces valeurs nulle part
               d'« officiel » : seul le statusline les met en cache → valeurs de la dernière
               session active (pas temps réel), `known:false` sans cache
  diff.ts      unifiedDiff **isomorphe** (LCS) : deux textes → lignes de diff unifié façon
               `git diff` (hunks `@@`, ajouts/retraits/contexte) pour le panneau Versions
  i18n.ts      getT() (serveur) : lit la langue du store → { locale, t } lié
  i18n/core.ts     translate/tPlural **isomorphes** (types + données statiques only,
               bundlables client) ; interpolation `{var}`, pluriel `.one`/`.other`
  i18n/translations.ts  dico plat pointé fr/en ; `en: Record<keyof typeof fr, string>`
               **force** une traduction anglaise pour chaque clé (erreur de compil sinon)
  --- LECTURE SEULE de ~/.claude.json (hors CLAUDE_DIR, champs ciblés — cf. Conventions) ---
  mcp.ts          getMcpServers : MCP globaux + par projet, statut d'auth, env masqué
  subscription.ts getSubscription (champs non sensibles d'oauthAccount) ·
               getEffectiveSubscription (choix manuel du store sinon auto) · PLANS/isManualPlan
  plugins.ts   getPlugins : marketplaces/plugins + catalogues (installLocation) + usage —
               jamais d'écriture, installation = CLI
app/
  page.tsx                             Dashboard analytics + RangeSelector
  skills/page.tsx · [name]/page.tsx    Liste · détail/éditeur d'un skill
  projects/page.tsx · [id]/page.tsx · [id]/[session]/page.tsx  Liste · sessions · transcript
  search/page.tsx                      Recherche full-text (coquille + SearchView client)
  config/preferences/page.tsx          Permissions + tarifs + abonnement + affichage
  config/pricing/page.tsx              Redirection → /config/preferences (compat)
  config/settings/page.tsx             Éditeur settings.json + settings.local.json (+ reset)
  config/hooks/page.tsx                Visualiseur + éditeur du bloc hooks
  config/agents|commands/page.tsx · [...slug]/page.tsx   Liste (+ création) · détail/éditeur/suppression
  config/graph/page.tsx                Graphe de dépendances (lecture seule)
  config/claude-md/page.tsx            Éditeur du CLAUDE.md global (+ reset/suppression)
  config/mcp|plugins/page.tsx          MCP servers · Plugins & Marketplaces (lecture seule)
  config/keybindings/page.tsx          Aperçu + éditeur (+ reset/suppression)
  config/trash/page.tsx                Corbeille (liste, restaurer, vider)
  docs/layout.tsx · page.tsx · [slug]/page.tsx · structure/page.tsx   Documentation + arbre .claude
  api/skills/route.ts                  POST { op, slug, raw } → SKILL.md write/create/delete (gated)
  api/config-file/route.ts             POST { op, target, raw } → fichiers uniques write/reset/delete (gated)
  api/backups/route.ts                 versions config ET skills/agents/commandes (target = cible config ou `skills|agents|commands/<slug>`) : GET ?target(&id?) liste/aperçu ; POST { op:restore|delete, target, id } (gated modify)
  api/md/route.ts                      POST { op, kind, slug, raw } → agents/commandes (gated)
  api/projects/route.ts                POST { op:delete, scope, projectId, sessionId? } → corbeille (gated)
  api/trash/route.ts                   GET listTrash ; POST restore (gated <resource>.delete) / delete / empty (gated trash.empty)
  api/hooks/route.ts                   POST { raw } → bloc hooks de settings.json (gated)
  api/export/route.ts                  GET ?scope&projectId&sessionId?&format&stats=0? (lecture seule)
  api/search/route.ts                  GET ?q&projectId?&thinking=1?&tools=1? (lecture seule)
  api/store/route.ts                   POST { section, … } → état claudeboard (dispatch par section whitelistée)
  layout.tsx · globals.css · icon.svg
proxy.ts       (racine, ex-`middleware.ts`) garde réseau avant toute route : `Host` loopback
               (anti-rebinding) + `Origin` loopback sur les méthodes mutantes (anti-CSRF)
components/
  Sidebar · Markdown · Collapsible · ConfirmDialog · ThemeToggle · ReadOnlyBadge
  I18nProvider (contexte client, `useTranslation`) · LanguageSelector (choix FR/EN)
  Écriture gated : ConfigEditor (JSON/markdown, validation live, backup au save, mode
    lecture seule via `canWrite`) · SkillEditor · PermissionsMatrix · PermissionNotice ·
    DeleteButton · ResetButton · CreateEntryButton (verrouillés → grisés + tooltip
    LOCKED_HINT de `lockedHint.ts`) · MdEntryList · MdEntryDetail · TrashList ·
    BackupsPanel (panneau Versions replié : liste les backups, badge « Actuelle » sur la
    version en place, diff `git diff` vs fichier actuel via `diff.ts`, restaure ou supprime
    une version — les deux gated par `modify` de la cible)
  Dashboard : ActivityPanel · ActivityHeatmap · TrendChart · DayDetail · ModelDonut ·
    RangeSelector · SubscriptionCard · SubscriptionSelector · CostStatCard · CostModeSelector ·
    PricingEditor · ProjectCostList · ToolUsageList · HourlyDistribution · UsageBanner
    (bandeau limites d'usage 5 h / 7 j, `components/UsageLimits.tsx` ; si cache absent :
    jauges vides + alerte → doc de configuration)
  Divers : FavoriteButton · ResumeButton · ExportButton · SearchView · SearchFab ·
    DependencyGraph · PluginCatalog · DirectoryExplorer (+ directoryTreeShared : type de
    nœud, badges, helpers inline `A`/`C` ; contenus par langue directoryTree.fr/.en) · DocsNav
```

## Conventions importantes

- **Next 16** : dans les pages, `params` est une **Promise** (`await params` avant de lire
  `id`/`name`/`session`). Consulte les guides `node_modules/next/dist/docs/` avant d'écrire
  du code (voir le bloc en fin de fichier).
- Toute page qui lit le FS déclare `export const dynamic = "force-dynamic"`.
- **Sécurité** : tout accès fichier passe par `safeResolve(...)` (anti-traversée `../`).
  `/api/skills` et `/api/md` refusent en plus les slugs de traversée et valident le
  frontmatter ; `/api/config-file` n'accepte que des cibles whitelistées.
  - **Exceptions** : `mcp.ts`, `subscription.ts`, `plugins.ts` lisent `~/.claude.json`
    (**hors** de CLAUDE_DIR, contient des secrets) → accès **lecture seule** et **ciblés**
    (`mcpServers` env masqué / champs non sensibles d'`oauthAccount` / `pluginUsage`).
    `plugins.ts` lit aussi les `marketplace.json` à leur `installLocation` (peut pointer hors
    de CLAUDE_DIR) — lecture seule.
- **Garde réseau (`proxy.ts`)** : app **locale sans auth**, donc le proxy filtre toutes les
  routes en amont — `Host` loopback (anti-rebinding) et, sur les méthodes mutantes, `Origin`
  loopback (**anti-CSRF**, sans quoi un site tiers pourrait piloter l'API et écrire un hook =
  RCE). **Ne pas retirer le check `Origin`.** La protection primaire reste le binding
  `127.0.0.1` ; `isAllowed()` reste la garde par route.
- **L'écriture n'est jamais silencieuse** : `writeSkill`/`writeMdEntry` exigent un fichier
  existant (pas de création) et archivent la version précédente **hors** de CLAUDE_DIR
  (`data/backups/`, clé `skills|agents|commands/<slug>`, cf. `backups.ts`) — tout comme
  `writeConfigFile` (settings/hooks/CLAUDE.md/keybindings) : plus aucun `.bak.<ts>` dans
  `~/.claude`, tout est restaurable depuis le panneau Versions. Les créations de config
  (`settings.local.json`, `keybindings.json`, `CLAUDE.md` global) sont explicites. Les
  **suppressions ne sont jamais destructives** : elles passent par `moveToTrash` vers
  `data/trash/` (**hors** de CLAUDE_DIR), restaurable depuis `/config/trash`.
- **Permissions** : toute mutation de `~/.claude` est gated par une permission
  (`PERMISSION_SCHEMA`, ressource × action). Le contrôle est fait **côté serveur** dans
  chaque route via `isAllowed(resource, action)` (403 sinon) ; l'UI ne fait que refléter
  l'état. Ajouter une action d'écriture ⇒ l'ajouter au schéma **et** la garder derrière
  `isAllowed`. Défaut : tout `false`.
- **État claudeboard vs config Claude** : les données qui n'appartiennent pas à Claude Code
  (favoris, tarifs, abonnement, permissions, préférences) vivent dans `data/claudeboard.json`
  (**hors** de CLAUDE_DIR, gitignored, écriture atomique). Ne jamais les mélanger avec les
  fichiers de `~/.claude`. `/api/store` valide et dispatche par `section` whitelistée.
- **i18n (FR/EN)** : `lib/i18n/core.ts` est **isomorphe** (aucune lecture FS/store — reste
  bundlable client). Côté serveur, les pages `async` appellent `await getT()` → `{ locale, t }`
  (lit `language` du store). Côté client, `I18nProvider` (seedé par `layout.tsx`) expose
  `useTranslation()`. Changer de langue = `setPreferences` puis `router.refresh()`, qui relit
  le store et re-seed le provider. Toute nouvelle chaîne visible ⇒ une clé dans **fr et en**
  (`translations.ts` ; l'anglais manquant est une **erreur de compilation**).
- **Analytics** : le coût est une **estimation locale** (tarifs `PRICING` indicatifs en
  USD/million de tokens), pas une facturation réelle. `getAnalytics` fait un **seul passage**
  sur les JSONL — garder l'agrégation là plutôt que multiplier les scans du FS.

## Développement

```
npm run dev     # démarre le dashboard en local
npm run build   # build de production
npm run lint    # ESLint (next lint)
```

Répertoire Claude non standard (ou tests) : `CLAUDE_DIR=/chemin/.claude npm run dev`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
