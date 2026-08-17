---
title: Sécurité
description: Autorisations opt-in, garde anti-traversée, écritures jamais silencieuses avec backups, suppressions réversibles et accès lecture seule cadrés.
order: 4
---

# Sécurité

Claudeboard lit — et parfois écrit — des fichiers personnels sur votre machine. Quatre
principes encadrent ces accès.

> 🔒 **100 % local — aucune donnée n'est envoyée où que ce soit.** claudeboard ne fait
> **aucun appel réseau** avec vos données : pas de télémétrie, pas d'analytics, pas de
> phone-home, pas d'API externe, pas de cloud. **Absolument tout reste sur votre disque.**
> Le serveur est lié à `localhost` ; le seul accès réseau du projet est `npm install`
> (dépendances) — jamais vos transcripts, votre config ni votre usage.

## 1. Autorisations d'écriture opt-in

Toute mutation de `~/.claude` est **conditionnée par une permission** du store
(`PERMISSION_SCHEMA` dans `lib/store.ts`, ressource × action). **Tout est `false` par
défaut** : l'app démarre en lecture seule intégrale et vous ouvrez explicitement, depuis
**Préférences → Autorisations d'écriture**, ce que vous l'autorisez à faire.

Le contrôle d'accès est fait **côté serveur** dans chaque route API via
`isAllowed(resource, action)` (réponse `403` sinon). L'UI ne fait que refléter l'état
(bouton masqué, bannière « lecture seule ») — masquer un bouton ne suffit jamais à lui
seul. Plugins & marketplaces sont volontairement **hors** de ce modèle (lecture seule).

## 2. Garde anti-traversée de répertoire

Tout accès fichier passe par `safeResolve(...)` (`lib/claude.ts`) pour empêcher une
traversée de répertoire (`../`) via un slug ou un id venant d'une URL. Le chemin résolu
doit **rester à l'intérieur de `CLAUDE_DIR`**, sinon une erreur est levée.

Les API d'écriture ajoutent leurs propres validations :

- `/api/skills` et `/api/md` refusent les slugs de traversée **et** valident le
  frontmatter avant d'écrire.
- `/api/config-file` n'accepte que des cibles **whitelistées**.
- `/api/store` valide et dispatche par `section` whitelistée (favoris, tarifs, abonnement,
  permissions, préférences).

La page `/docs` lit `docs/` (dans le repo, hors `~/.claude`) : elle n'utilise donc pas
`safeResolve` mais un garde-fou de slug dédié (`^[a-z0-9-]+$`) dans `lib/docs.ts`.

## 3. L'écriture n'est jamais silencieuse — et les suppressions sont réversibles

- `writeSkill` / `writeMdEntry` vérifient que le fichier **existe déjà** (pas de création
  implicite) et créent **toujours un backup** horodaté avant d'écraser.
- Les créations de fichiers de config (`settings.local.json`, `keybindings.json`,
  `CLAUDE.md` global) via `writeConfigFile` sont **explicites** (flux « Créer » dans
  `ConfigEditor`).
- Les **suppressions ne sont jamais destructives** : elles passent par `moveToTrash`
  (`lib/trash.ts`), qui déplace le fichier/dossier vers `data/trash/<id>/` — **hors** de
  `CLAUDE_DIR`, à la racine du projet (override `TRASH_DIR`) — au lieu de l'effacer.
  Chaque entrée conserve un `meta.json` de restauration, restaurable ou vidable depuis
  `/config/trash` (vidage gated par `trash.empty`).

> **État propre à claudeboard vs config Claude.** Les données qui n'appartiennent pas à
> Claude Code (favoris, overrides de tarifs, choix d'abonnement, permissions, préférences
> d'affichage) vivent dans `data/claudeboard.json` — **hors** de `CLAUDE_DIR` et de
> `~/.claude`, à la racine du projet (gitignored, écriture atomique via `lib/store.ts`).

## 4. Accès lecture seule cadrés (exceptions documentées)

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

L'app est **locale par conception** : pas de télémétrie, pas d'auth, **aucun envoi réseau
de vos données — absolument tout reste sur votre machine**. Elle démarre en **lecture
seule** (permissions opt-in), toute écriture crée un backup, et toute suppression est
réversible via la corbeille. Voir aussi [Prise en main](./prise-en-main.md).
