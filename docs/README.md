# Documentation — Claudeboard

Cette documentation est **la même** que celle affichée dans l'application, sur la page
`/docs`. Les fichiers `.md` de ce dossier sont la source unique : lisibles ici sur GitHub,
et rendus proprement dans le dashboard. Chaque page existe en deux langues, dans
`docs/fr/` et `docs/en/` (le français fait référence ; l'anglais est servi selon la langue
choisie dans **Préférences**, avec repli sur le français si une traduction manque).

## Sommaire (français)

1. [Prise en main](./fr/prise-en-main.md) — ce qu'est l'app, prérequis, installation, lancement.
2. [Architecture](./fr/architecture.md) — stack, structure du code, conventions Next 16.
3. [Fonctionnalités](./fr/fonctionnalites.md) — dashboard, skills, projets, config.
4. [Métriques & estimation](./fr/metriques.md) — coût (IN/OUT, formule, cache) et durées (temps actif).
5. [Sécurité](./fr/securite.md) — garde anti-traversée, backups, accès lecture seule.
6. [Développement](./fr/developpement.md) — scripts, vérification, contribution.

## Table of contents (English)

1. [Getting started](./en/prise-en-main.md) — what the app is, prerequisites, install, running.
2. [Architecture](./en/architecture.md) — stack, code structure, Next 16 conventions.
3. [Features](./en/fonctionnalites.md) — dashboard, skills, projects, config.
4. [Metrics & estimation](./en/metriques.md) — cost (IN/OUT, formula, cache) and durations (active time).
5. [Security](./en/securite.md) — path-traversal guard, backups, read-only access.
6. [Development](./en/developpement.md) — scripts, verification, contributing.

> Astuce : pour naviguer cette doc avec un rendu soigné (thème clair/sombre, sommaire
> latéral), lancez le dashboard (`npm run dev`) et ouvrez **Documentation** dans la barre
> latérale, ou directement `/docs`.
