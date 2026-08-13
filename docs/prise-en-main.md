---
title: Prise en main
description: Ce qu'est Claudeboard, les prérequis, l'installation et le lancement en local.
order: 1
---

# Prise en main

**Claudeboard** est un dashboard **local** (Next.js) pour visualiser et éditer la
configuration Claude Code stockée dans `~/.claude`. Il lit directement le système de
fichiers de votre machine.

> ⚠️ Il n'est **pas** destiné à être déployé : pas de télémétrie, pas d'authentification,
> il tourne uniquement en local et lit vos fichiers personnels.

## Prérequis

- **Node.js** (version récente, compatible Next.js 16) et **npm**.
- Un dossier `~/.claude` déjà peuplé par une utilisation de Claude Code : c'est lui qui
  contient les transcripts de sessions (`projects/*/*.jsonl`), les skills, agents,
  commandes et fichiers de configuration que le dashboard exploite.

Sans historique dans `~/.claude`, l'app fonctionne mais la plupart des vues seront vides.

## Installation

```bash
git clone <repo>
cd claudeboard
npm install
```

## Lancement

```bash
npm run dev      # démarre le dashboard en local (http://localhost:3000)
```

Puis ouvrez l'URL affichée dans le terminal. Le dashboard lit `~/.claude` à chaque
requête (les pages qui touchent au système de fichiers sont en `force-dynamic`), donc
vos dernières sessions apparaissent sans rebuild.

## Pointer vers un autre dossier `.claude`

Par défaut, l'app lit `~/.claude`. Pour cibler un répertoire non standard (ou un jeu de
données de test), surchargez la variable d'environnement `CLAUDE_DIR` :

```bash
CLAUDE_DIR=/chemin/vers/.claude npm run dev
```

## Et ensuite ?

- [Architecture](./architecture.md) — comment le code est organisé.
- [Fonctionnalités](./fonctionnalites.md) — le tour complet des écrans.
- [Sécurité](./securite.md) — pourquoi la lecture de vos fichiers reste cadrée.
