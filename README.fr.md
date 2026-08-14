# claudeboard

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/🇬🇧_English-555555?style=for-the-badge" alt="English"></a>
  &nbsp;
  <a href="./README.fr.md"><img src="https://img.shields.io/badge/🇫🇷_Français-2ea44f?style=for-the-badge" alt="Français"></a>
</p>

Un dashboard **local** pour analyser, parcourir et éditer la configuration Claude Code stockée dans `~/.claude`.

Construit avec **Next.js 16** (App Router, React Server Components) et **React 19**. Il lit directement le système de fichiers de la machine — **il n'est pas destiné à être déployé** : pas de télémétrie, pas d'auth, tourne uniquement en localhost. La page d'accueil agrège tous les transcripts de conversation en un **seul passage** (`lib/analytics.ts` → `getAnalytics`) en KPI, heatmap d'activité, répartition tokens/coût par modèle et coût estimé. Skills, agents, commandes et fichiers de config s'éditent sur place (chaque écriture crée d'abord un backup horodaté `.bak`) ; projets, sessions, hooks, serveurs MCP et plugins sont strictement **en lecture seule**. Tout accès fichier passe par une garde `safeResolve` qui maintient les chemins à l'intérieur de `~/.claude` pour empêcher une traversée de répertoire depuis un slug d'URL.

> 🔒 **100 % local — rien ne quitte jamais votre machine.** claudeboard ne fait **aucun appel réseau** avec vos données : pas de télémétrie, pas d'analytics, pas de phone-home, pas d'API externe, pas de cloud. **Absolument tout reste sur votre disque.** Il ne lit et n'écrit que des fichiers locaux sous `~/.claude`, et le serveur est lié à `localhost`. Le seul accès réseau est `npm install` (récupération des dépendances) — jamais vos transcripts, votre config ni votre usage.

> ⚠️ **Non affilié à Anthropic.** claudeboard est un projet indépendant et communautaire. Il n'est ni approuvé par, ni lié à Anthropic d'aucune manière — « Claude » n'est mentionné que pour décrire ce que l'outil lit.

> 💡 **Pourquoi ce projet ?** Claude Code éparpille sa config dans `~/.claude` — les skills en fichiers `SKILL.md`, les transcripts de conversation en `.jsonl` bruts, les settings, hooks, agents, plugins. claudeboard transforme ce dossier opaque en un dashboard navigable et éditable — avec de vraies analytics d'usage — sans jamais quitter votre machine.

> 📥 **Source des données.** Les transcripts lus par claudeboard proviennent **uniquement** de Claude Code lui-même : le **CLI** (`entrypoint: cli`) et l'**extension VS Code** (`entrypoint: claude-vscode`), qui écrivent tous deux dans `~/.claude/projects/*/*.jsonl`. Rien d'autre n'est inclus — ni claude.ai (web), ni l'app Claude Desktop, ni l'usage API brut.

![Capture d'écran de claudeboard](public/screenshot.png)

## Stack

| Couche | Technologie |
|---|---|
| Framework | Next.js 16 — App Router, RSC par défaut, pages FS en `force-dynamic` |
| UI | React 19, TypeScript (strict), alias d'import `@/*` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`, pas de `tailwind.config`) |
| Frontmatter | `gray-matter` (parse/serialize YAML) |
| Markdown | `react-markdown` + `remark-gfm` |
| Icônes | `lucide-react` |

## Structure

```
claudeboard/
├── lib/
│   ├── claude.ts          # CLAUDE_DIR + safeResolve (garde anti-traversée) + formatage date/taille/durée
│   ├── analytics.ts       # getAnalytics : un seul passage JSONL → totaux, heatmap, tokens/coût par modèle,
│   │                       #   top outils, coût par projet, heures de session, vélocité N vs N-1 · PRICING
│   ├── skills.ts          # listSkills · getSkill · writeSkill (backup .bak avant écrasement)
│   ├── projects.ts        # listProjects · listSessions · getSession · normalisation des blocs JSONL
│   ├── mdEntries.ts       # agents & commandes (.md à frontmatter, slugs imbriqués = namespaces)
│   ├── configFiles.ts     # read/writeConfigFile : settings, CLAUDE.md, keybindings (JSON validé, backup)
│   ├── hooks.ts           # getHooks : hooks des deux fichiers settings, groupés par event (lecture seule)
│   ├── mcp.ts             # getMcpServers : lecture seule de ~/.claude.json, valeurs d'env masquées
│   ├── plugins.ts         # getPlugins : lecture seule du catalogue marketplaces/plugins
│   ├── subscription.ts    # getSubscription : lecture seule du plan Claude (champs non sensibles)
│   ├── keybindings.ts     # parseKeybindings : extraction défensive pour l'aperçu tabulaire
│   └── docs.ts            # listDocs · getDoc : rend les fichiers .md de docs/ sur /docs
├── app/
│   ├── page.tsx           # Dashboard analytics (KPI, heatmap, modèles, coût, RangeSelector)
│   ├── skills/            # liste · [name] (détail + éditeur)
│   ├── projects/          # liste · [id] (sessions) · [id]/[session] (transcript)
│   ├── config/            # settings · hooks · claude-md · agents · commands · mcp ·
│   │                       #   plugins · keybindings · pricing · directory
│   ├── docs/              # layout · page · [slug] (rend docs/*.md)
│   ├── api/               # skills · config-file · md (endpoints POST d'écriture, validés)
│   └── layout.tsx · globals.css · icon.svg
├── components/            # Sidebar · Markdown · ConfigEditor · ActivityHeatmap · ModelDonut ·
│                           #   RangeSelector · SubscriptionCard · HourlyDistribution · DocsNav · …
├── docs/                  # doc projet bilingue (.md) — même source rendue sur /docs
└── AGENTS.md              # instructions projet (aliasé par CLAUDE.md)
```

## Fonctionnalités

- **Dashboard analytics (`/`)** — agrège tous les transcripts JSONL en un seul passage : KPI (projets, sessions, messages, tokens, coût estimé), **heatmap d'activité** sur 12 mois, camembert des modèles (`ModelDonut`) avec comptes IN/OUT, tokens & coût par modèle, coût par projet, distribution horaire des débuts de session (heure locale), outils/skills les plus utilisés et stats de session. Un `RangeSelector` filtre la fenêtre (tout / 30 j / 7 j / un mois donné / une plage libre) ; les KPI concernés affichent un **delta de vélocité** vs la période précédente de même durée (N vs N-1). Une `SubscriptionCard` compare le coût d'usage estimé au prix de votre plan Claude.
- **Skills (`/skills`)** — liste, aperçu et **édition** de chaque `~/.claude/skills/*/SKILL.md` (frontmatter YAML + corps markdown). Chaque sauvegarde écrit un `SKILL.md.bak.<timestamp>` horodaté avant d'écraser.
- **Projets & Sessions (`/projects`)** — navigation **en lecture seule** des transcripts `~/.claude/projects/*/*.jsonl`, chaque ligne normalisée en blocs `text`, `thinking`, `tool_use` et `tool_result`. La page d'un projet affiche aussi ses stats agrégées (`getProjectStats`).
- **Config (`/config/*`)** — **Settings** (édition de `settings.json` / `settings.local.json`, JSON validé live + backup), **Hooks** (lecture seule, groupés par event), **Agents** & **Commandes** (liste/aperçu/édition, sous-dossiers = namespaces), éditeur du **CLAUDE.md global**, **serveurs MCP** (lecture seule, `env` masqué), **Plugins & Marketplaces** (lecture seule, l'installation reste dans le CLI), **Keybindings** (tableau + éditeur JSON), **Tarifs** (table d'estimation) et **Structure du dossier** (arbre `.claude` pédagogique).
- **Documentation (`/docs`)** — rend les fichiers `.md` de `docs/` avec un sommaire latéral, pour que la doc projet soit lisible aussi bien sur GitHub que dans l'app.
- **Thème** — bascule clair/sombre, persistée dans `localStorage` et appliquée avant le premier rendu (pas de flash).

## Variables d'environnement

L'app n'a besoin d'aucune configuration pour tourner. Copier `.env.example` en `.env` pour surcharger le défaut. Une seule variable optionnelle permet de la pointer vers un dossier Claude non standard (utile pour les tests) :

| Variable | Défaut | Description |
|---|---|---|
| `CLAUDE_DIR` | `~/.claude` | Racine de la config Claude Code à lire/éditer. Tout est confiné sous ce chemin. |

> 🔒 **Modèle de menace.** claudeboard lit et écrit votre système de fichiers local sans authentification. C'est un outil **localhost uniquement** — ne l'exposez pas sur un réseau et ne le déployez pas. La traversée de répertoire depuis un slug d'URL est bloquée par `safeResolve` (tout doit se résoudre dans `CLAUDE_DIR`), et les API d'écriture refusent en plus les slugs de traversée et valident le frontmatter/JSON avant d'écrire. `lib/mcp.ts`, `lib/subscription.ts` et `lib/plugins.ts` lisent `~/.claude.json` (qui est hors de `CLAUDE_DIR` et contient des secrets) de façon **ciblée et en lecture seule** uniquement — les valeurs d'`env` sont masquées et jamais écrites.

## Développement

```bash
npm install
npm run dev        # démarre le dashboard en localhost
```

Pour le pointer vers un dossier Claude non standard (ou pour des tests) :

```bash
CLAUDE_DIR=/chemin/.claude npm run dev
```

Autres scripts :

```bash
npm run build      # build de production
npm run start      # sert le build de production
npm run lint       # ESLint (next lint)
```

## Architecture

- **Lectures** — `getAnalytics` scanne tous les transcripts JSONL en un **seul passage** pour construire chaque chiffre du dashboard ; les libs config/skills/projets lisent `~/.claude` à la demande. Toutes les pages qui touchent au FS déclarent `export const dynamic = "force-dynamic"` puisque les données changent hors du cycle de build.
- **Écritures** — seuls les skills, agents, commandes et fichiers de config sont modifiables, via `POST /api/skills`, `/api/md` et `/api/config-file`. `writeSkill`/`writeMdEntry` refusent de créer un nouveau fichier (il doit déjà exister) et le copient toujours vers un `.bak` horodaté avant d'écraser ; la création de fichiers de config (`settings.local.json`, `keybindings.json`, `CLAUDE.md` global) est explicite.
- **Sûreté** — chaque chemin dans `CLAUDE_DIR` est construit avec `safeResolve(...)`, qui lève une erreur si le résultat en sort. Les lectures seules de `~/.claude.json` (`mcp.ts`, `subscription.ts`, `plugins.ts`) sont les exceptions documentées, limitées à des champs non sensibles.
- **Note Next 16** — dans les pages, `params` est une **Promise** et doit être `await`é avant de lire `id`/`name`/`slug`/`session`.

## Schéma

```mermaid
flowchart TD
    subgraph CLIENT["Client (navigateur)"]
      UI["Dashboard · éditeurs · RangeSelector"]
    end
    subgraph SERVER["Serveur Next.js 16"]
      PAGES["Pages RSC (force-dynamic)"]
      API["POST /api/skills · /api/md · /api/config-file"]
      ANALYTICS["analytics.ts — passage unique JSONL"]
      LIB["lib : skills · projects · configFiles · mdEntries · …"]
      GUARD["safeResolve — garde anti-traversée"]
    end
    subgraph FS["~/.claude (système de fichiers)"]
      TRANSCRIPTS["projects/*/*.jsonl"]
      SKILLS["skills · agents · commands · settings"]
      BAK["*.bak.&lt;ts&gt;"]
    end
    subgraph EXT["~/.claude.json (hors CLAUDE_DIR)"]
      MCP["mcpServers · pluginUsage · oauthAccount"]
    end

    UI -->|navigation| PAGES
    UI -->|sauvegarde| API
    PAGES --> ANALYTICS
    PAGES --> LIB
    API --> LIB
    ANALYTICS -->|lecture seule| TRANSCRIPTS
    LIB --> GUARD
    GUARD -->|lecture| SKILLS
    GUARD -->|backup puis écriture| SKILLS
    GUARD -.->|backup| BAK
    LIB -.->|lecture seule, masqué| MCP

    style CLIENT fill:#1e293b,color:#fff
    style SERVER fill:#0f766e,color:#fff
    style FS fill:#7c2d12,color:#fff
    style EXT fill:#3f3f46,color:#fff
```
