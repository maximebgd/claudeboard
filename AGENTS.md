# claudeboard

Dashboard **local** (Next.js) pour visualiser et éditer la configuration Claude Code
stockée dans `~/.claude`. Il lit le système de fichiers de la machine — il n'est pas
destiné à être déployé : pas de télémétrie, pas d'auth, tourne uniquement en local.

## Ce que fait l'app

- **Dashboard / analytics** (page d'accueil) : agrège tous les transcripts JSONL en
  un seul passage (`lib/analytics.ts` → `getAnalytics`) pour afficher KPI (projets,
  sessions, messages, tokens, coût estimé), heatmap d'activité sur 12 mois,
  répartition des modèles (camembert), tokens & coût par modèle, outils/skills les
  plus utilisés, stats de session (moyennes, durées, ratio thinking/texte) et projets
  récents. Un sélecteur de fenêtre (`Tout` / `30 j` / `7 j`, via `?range=`) filtre les
  stats ; la heatmap montre toujours l'historique complet.
- **Skills** : liste, aperçu et **édition** des `~/.claude/skills/*/SKILL.md`
  (frontmatter YAML + corps markdown). Toute écriture crée d'abord un backup
  horodaté `SKILL.md.bak.<timestamp>` à côté du fichier.
- **Projets & Sessions** : navigation **en lecture seule** dans
  `~/.claude/projects/*/*.jsonl` (transcripts de conversations). Chaque ligne JSONL
  est normalisée en blocs (`text`, `thinking`, `tool_use`, `tool_result`).
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
  - **Keybindings** (`~/.claude/keybindings.json`) : aperçu tabulaire + éditeur JSON,
    création si absent.
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
  analytics.ts getAnalytics(sinceMs) : scan unique des JSONL → totaux, jours (heatmap),
               stats par modèle, top outils, durées ; parseModel + tarifs indicatifs
  configFiles.ts read/writeConfigFile : fichiers uniques (settings, settings.local,
               CLAUDE.md, keybindings) — JSON validé, backup si existant, création explicite
  mdEntries.ts list/get/writeMdEntry(kind) : agents & commandes (.md à frontmatter,
               slugs imbriqués = namespaces) ; même modèle que skills
  hooks.ts     getHooks : normalise les hooks des deux settings, groupés par event
  mcp.ts       getMcpServers : LECTURE SEULE de ~/.claude.json (hors CLAUDE_DIR), MCP
               globaux + par projet, statut via mcp-needs-auth-cache.json, env masqué
  keybindings.ts parseKeybindings : extraction défensive pour l'aperçu tabulaire
app/
  page.tsx                       Dashboard analytics (KPI, heatmap, modèles, outils,
                                 sessions, projets récents) + sélecteur ?range=
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
  config/keybindings/page.tsx    Aperçu + éditeur des keybindings
  api/skills/route.ts            POST { slug, raw } → écrit le SKILL.md (+ validations)
  api/config-file/route.ts       POST { target, raw } → fichiers uniques (JSON validé)
  api/md/route.ts                POST { kind, slug, raw } → agents/commandes (frontmatter validé)
  layout.tsx · globals.css · icon.svg
components/
  Sidebar · Markdown · Collapsible · ConfirmDialog · SkillEditor ·
  ConfigEditor (éditeur générique JSON/markdown : validation live, backup au save) ·
  MdEntryList · MdEntryDetail (liste/détail partagés agents & commandes) ·
  ActivityHeatmap (heatmap façon GitHub) · ThemeToggle (clair/sombre)
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
  - **Exception documentée** : `lib/mcp.ts` lit `~/.claude.json`, qui est **hors de
    CLAUDE_DIR** et contient des secrets. C'est donc un accès **lecture seule** et
    **ciblé** (uniquement les clés `mcpServers`), qui n'expose jamais les valeurs d'`env`.
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
