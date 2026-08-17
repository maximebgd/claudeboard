---
title: Métriques & estimation
description: Comment le dashboard calcule le coût (convention IN/OUT, formule, cache TTL 1 h) et les durées (temps actif) qu'il affiche.
order: 4
---

# Métriques & estimation

Cette page explique comment le dashboard calcule les deux chiffres les moins évidents : le
**coût estimé** et les **durées**. Tout est calculé **localement** à partir des transcripts.

## Coût

Le coût affiché est une **estimation locale** (tarifs indicatifs par famille de modèle),
**pas une facturation réelle**. Les tarifs par défaut viennent de `lib/analytics.ts` ; vous
pouvez les ajuster dans **Préférences → Tarifs d'estimation** (les overrides sont stockés
dans `data/claudeboard.json` et appliqués à toutes les estimations).

### Convention IN / OUT

Partout dans le dashboard, l'affichage suit ce sens :

- **IN** ⬆ = ce que vous envoyez (votre prompt : instructions, historique, fichiers…).
- **OUT** ⬇ = ce que vous recevez (la réponse générée par le modèle).

### Comment le coût est calculé

Pour chaque réponse de l'assistant, on lit son bloc `usage` et on applique :

```
coût = (input        × prix_in
      + output       × prix_out
      + cache_read   × prix_cacheRead
      + cache_write  × prix_cacheWrite) / 1 000 000
```

Le tarif dépend de la **famille du modèle** (déduite de l'id, ex. `claude-opus-4-8` →
Opus). Les modèles inconnus ou synthétiques sont facturés à 0.

### Écriture cache : TTL 1 h

Le prix d'écriture cache utilise le tarif **TTL 1 h** (celui employé par Claude Code). Les
tokens `cache_creation_input_tokens` sont tous facturés à ce tarif.

## Durées (temps actif)

Les durées affichées (par session, par projet et au total) mesurent le **temps actif**, et
non le temps écoulé entre le premier et le dernier message.

Pour une session, on trie les horodatages de ses messages et on additionne les écarts entre
messages consécutifs, **en ignorant tout trou d'inactivité de plus de 30 minutes** :

```
temps_actif(session) = Σ (msg[i] − msg[i−1])   pour chaque écart ≤ 30 min
```

Ce seuil de 30 min évite qu'une session laissée ouverte (long silence puis reprise) ne
gonfle la durée avec son écart brut début→fin. Une session d'un seul message a une durée
de 0.

- **Durée totale d'un projet** = somme des temps actifs de toutes ses sessions
  (`getProjectStats`).
- **Durée totale (dashboard)** = somme des temps actifs de toutes les sessions de la fenêtre
  active ; le dashboard en dérive aussi la **moyenne** et la **médiane** par session.

Voir aussi : [Fonctionnalités](./fonctionnalites.md) pour le dashboard analytics (les tarifs
s'éditent depuis **Préférences → Tarifs d'estimation** dans l'app).
