---
title: Coûts & estimation
description: Convention IN / OUT, formule de calcul du coût et tarif d'écriture cache (TTL 1 h).
order: 4
---

# Coûts & estimation

Le dashboard affiche un **coût estimé** de votre usage. C'est une **estimation locale**
(tarifs indicatifs par famille de modèle), **pas une facturation réelle**. Les tarifs par
défaut viennent de `lib/analytics.ts` ; vous pouvez les ajuster dans
**Préférences → Tarifs d'estimation** (les overrides sont stockés dans
`data/claudeboard.json` et appliqués à toutes les estimations).

## Convention IN / OUT

Partout dans le dashboard, l'affichage suit ce sens :

- **IN** ⬆ = ce que vous envoyez (votre prompt : instructions, historique, fichiers…).
- **OUT** ⬇ = ce que vous recevez (la réponse générée par le modèle).

## Comment le coût est calculé

Pour chaque réponse de l'assistant, on lit son bloc `usage` et on applique :

```
coût = (input        × prix_in
      + output       × prix_out
      + cache_read   × prix_cacheRead
      + cache_write  × prix_cacheWrite) / 1 000 000
```

Le tarif dépend de la **famille du modèle** (déduite de l'id, ex. `claude-opus-4-8` →
Opus). Les modèles inconnus ou synthétiques sont facturés à 0.

## Écriture cache : TTL 1 h

Le prix d'écriture cache utilise le tarif **TTL 1 h** (celui employé par Claude Code). Les
tokens `cache_creation_input_tokens` sont tous facturés à ce tarif.

Voir aussi : [Fonctionnalités](./fonctionnalites.md) pour le dashboard analytics (les
tarifs s'éditent depuis **Préférences → Tarifs d'estimation** dans l'app).
