---
title: Sécurité
description: Garde anti-traversée, écritures jamais silencieuses avec backups, et accès lecture seule cadrés.
order: 4
---

# Sécurité

Claudeboard lit — et parfois écrit — des fichiers personnels sur votre machine. Trois
principes encadrent ces accès.

## 1. Garde anti-traversée de répertoire

Tout accès fichier passe par `safeResolve(...)` (`lib/claude.ts`) pour empêcher une
traversée de répertoire (`../`) via un slug ou un id venant d'une URL. Le chemin résolu
doit **rester à l'intérieur de `CLAUDE_DIR`**, sinon une erreur est levée.

Les API d'écriture ajoutent leurs propres validations :

- `/api/skills` et `/api/md` refusent les slugs de traversée **et** valident le
  frontmatter avant d'écrire.
- `/api/config-file` n'accepte que des cibles **whitelistées**.

La page `/docs` lit `docs/` (dans le repo, hors `~/.claude`) : elle n'utilise donc pas
`safeResolve` mais un garde-fou de slug dédié (`^[a-z0-9-]+$`) dans `lib/docs.ts`.

## 2. L'écriture n'est jamais silencieuse

- `writeSkill` / `writeMdEntry` vérifient que le fichier **existe déjà** (pas de création
  implicite) et créent **toujours un backup** horodaté avant d'écraser.
- Les créations de fichiers de config (`settings.local.json`, `keybindings.json`,
  `CLAUDE.md` global) via `writeConfigFile` sont **explicites** (flux « Créer » dans
  `ConfigEditor`).

## 3. Accès lecture seule cadrés (exceptions documentées)

`lib/mcp.ts`, `lib/subscription.ts` et `lib/plugins.ts` lisent `~/.claude.json`, qui est
**hors de `CLAUDE_DIR`** et contient des secrets. Ces accès sont **lecture seule** et
**ciblés** :

- `mcp.ts` ne lit que `mcpServers` (valeurs d'`env` **masquées**) ;
- `subscription.ts` ne lit que des champs **non sensibles** d'`oauthAccount` ;
- `plugins.ts` ne lit que `pluginUsage` (et les `marketplace.json` à leur
  `installLocation`, qui peut pointer hors de `CLAUDE_DIR` pour un marketplace de type
  `directory`).

Aucune de ces fonctions n'écrit quoi que ce soit.

## En résumé

L'app est **locale par conception** : pas de télémétrie, pas d'auth, aucun envoi réseau
de vos données. Voir aussi [Prise en main](./prise-en-main.md).
