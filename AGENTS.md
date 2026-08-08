# claudeboard

Dashboard **local** (Next.js) pour visualiser et éditer la configuration Claude Code
stockée dans `~/.claude`. Il lit le système de fichiers de la machine — il n'est pas
destiné à être déployé : pas de télémétrie, pas d'auth, tourne uniquement en local.

## Ce que fait l'app

- **Skills** : liste, aperçu et **édition** des `~/.claude/skills/*/SKILL.md`
  (frontmatter YAML + corps markdown). Toute écriture crée d'abord un backup
  horodaté `SKILL.md.bak.<timestamp>` à côté du fichier.
- **Projets & Sessions** : navigation **en lecture seule** dans
  `~/.claude/projects/*/*.jsonl` (transcripts de conversations). Chaque ligne JSONL
  est normalisée en blocs (`text`, `thinking`, `tool_use`, `tool_result`).

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
  projects.ts  listProjects · listSessions · getSession · normalisation des blocs JSONL
app/
  page.tsx                       Vue d'ensemble (compteurs + skills récents)
  skills/page.tsx                Liste des skills
  skills/[name]/page.tsx         Détail + éditeur d'un skill
  projects/page.tsx              Liste des projets
  projects/[id]/page.tsx         Sessions d'un projet
  projects/[id]/[session]/page.tsx   Transcript d'une session
  api/skills/route.ts            POST { slug, raw } → écrit le SKILL.md (+ validations)
  layout.tsx · globals.css · icon.svg
components/
  Sidebar · Markdown · Collapsible · ConfirmDialog · SkillEditor
```

## Conventions importantes

- **Next 16** : dans les pages, `params` est une **Promise** — il faut `await params`
  avant de lire `id`/`name`/`session`. Consulte les guides dans
  `node_modules/next/dist/docs/` avant d'écrire du code (voir le bloc ci-dessous).
- Toutes les pages qui lisent le FS déclarent `export const dynamic = "force-dynamic"`
  (les données changent hors du cycle de build).
- **Sécurité** : tout accès fichier passe par `safeResolve(...)` pour empêcher une
  traversée de répertoire (`../`) via un slug/id d'URL. L'API `/api/skills` refuse en
  plus les slugs contenant `/` ou `..` et valide le frontmatter avant d'écrire.
- L'écriture de skills n'est jamais silencieuse : `writeSkill` vérifie que le fichier
  existe déjà (pas de création) et crée toujours un backup.

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
