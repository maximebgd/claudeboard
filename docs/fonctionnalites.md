---
title: Fonctionnalités
description: Le tour complet des écrans — dashboard analytics, skills, projets & sessions, et la config Claude.
order: 3
---

# Fonctionnalités

## Dashboard / analytics (page d'accueil)

Agrège tous les transcripts JSONL en un seul passage (`lib/analytics.ts` → `getAnalytics`)
pour afficher :

- **KPI** : projets, sessions, messages, tokens, coût estimé.
- **Heatmap d'activité** sur 12 mois (façon GitHub) — montre toujours l'historique
  complet, la fenêtre active y est surlignée.
- **Répartition des modèles** : camembert (`ModelDonut`) avec messages IN/OUT au survol,
  tokens & coût par modèle.
- **Coût par projet** (`ProjectCostList`) avec recherche/tri côté client.
- **Distribution horaire** des débuts de session (`HourlyDistribution` : 24 barres, heure
  **locale**, comptage brut par heure).
- **Outils / skills** les plus utilisés (`ToolUsageList`).
- **Stats de session** : moyennes, durées, ratio thinking/texte, projets récents.
- **Abonnement** (`SubscriptionCard`) : compare le coût estimé de l'usage au prix du plan
  Claude (via `lib/subscription.ts`) pour afficher l'économie nette.

### Sélecteur de fenêtre (`RangeSelector`)

Filtre les stats : `Tout` / `30 j` / `7 j`, un mois précis, ou une plage libre.
`getAnalytics(sinceMs, untilMs)` prend les deux bornes. Chaque carte KPI concernée
(Messages, Tokens, Coût) affiche un **delta de vélocité** : la variation vs la période
précédente de même durée (N vs N-1) — masqué pour la fenêtre « Tout ».

> Le **coût est une estimation locale** (tarifs indicatifs par famille de modèle), pas une
> facturation réelle. Voir la page **Tarifs d'estimation** dans la config.

## Skills

Liste, aperçu et **édition** des `~/.claude/skills/*/SKILL.md` (frontmatter YAML + corps
markdown). Toute écriture crée d'abord un **backup horodaté** `SKILL.md.bak.<timestamp>` à
côté du fichier.

## Projets & Sessions

Navigation **en lecture seule** dans `~/.claude/projects/*/*.jsonl` (transcripts). Chaque
ligne JSONL est normalisée en blocs (`text`, `thinking`, `tool_use`, `tool_result`). La
page d'un projet affiche aussi ses statistiques agrégées (`getProjectStats`) au-dessus de
la liste des sessions.

## Config Claude (section « Config »)

- **Settings** : édition de `settings.json` et `settings.local.json` (JSON validé live +
  backup, création de `.local` à la demande).
- **Hooks** : visualiseur **lecture seule** groupé par event (fusion des deux settings).
- **Agents** (`~/.claude/agents/*`) et **Commandes** (`~/.claude/commands/**`) :
  liste/aperçu/édition (sous-dossiers de commands = namespaces).
- **CLAUDE.md global** : éditeur markdown, création si absent.
- **MCP servers** : **lecture seule** des serveurs de `~/.claude.json` + statut d'auth
  (valeurs d'`env` masquées).
- **Plugins & Marketplaces** : **lecture seule** des marketplaces et catalogues, KPI et
  plugins bloqués ; l'installation reste du ressort du CLI (`/plugin install …`, commande
  copiable).
- **Keybindings** (`~/.claude/keybindings.json`) : aperçu tabulaire + éditeur JSON.
- **Tarifs d'estimation** : tableau des tarifs `PRICING` (in/out/cache) et formule de coût.
- **Structure du dossier** : arbre pédagogique du contenu de `.claude/`.

## Thème

Bascule clair/sombre (`ThemeToggle` dans la Sidebar), persistée dans `localStorage` et
appliquée avant le premier rendu (pas de flash).
