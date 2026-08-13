---
title: Développement
description: Scripts npm, méthode de vérification, et rappels pour contribuer au code.
order: 5
---

# Développement

## Scripts

```bash
npm run dev      # démarre le dashboard en local
npm run build    # build de production
npm run lint     # ESLint (next lint)
```

Pour pointer vers un répertoire Claude non standard (ou pour des tests) :

```bash
CLAUDE_DIR=/chemin/.claude npm run dev
```

## Vérifier un changement

Utilisez **`npm run build`** pour vérifier qu'un changement compile (TypeScript strict +
ESLint). N'utilisez **pas** `npm run start` pendant le développement : cela entre en
conflit avec un `npm run dev` déjà lancé.

## Rappels pour contribuer

- **Next 16, `params` = `Promise`** : `await params` avant de lire `id`/`name`/`slug`.
- **`force-dynamic`** sur toute page qui lit le système de fichiers.
- **Cette version de Next a des changements cassants.** Consultez les guides dans
  `node_modules/next/dist/docs/` avant d'écrire du code Next — les APIs et conventions
  peuvent différer de ce que vous connaissez.
- **Sécurité** : passez par `safeResolve` pour tout accès dans `CLAUDE_DIR`, validez les
  entrées d'URL, et gardez les écritures explicites avec backup (voir
  [Sécurité](./securite.md)).
- **Analytics** : gardez l'agrégation dans le passage unique de `getAnalytics` plutôt que
  de multiplier les scans du FS.

## Mettre à jour cette documentation

Les pages de `/docs` sont les fichiers `.md` du dossier `docs/`. Pour ajouter une page :
créez `docs/<slug>.md` avec un frontmatter `title` / `description` / `order`, et elle
apparaîtra automatiquement dans le sommaire du site (et sur GitHub).
