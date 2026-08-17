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
- **Panneau d'activité** (`ActivityPanel`) : bascule entre une **heatmap** sur 12 mois
  (façon GitHub) et une **courbe des messages par jour** (`TrendChart`), avec un **streak**
  de jours consécutifs. Cliquer un jour ouvre un panneau de détail partagé (`DayDetail`).
  Les deux vues montrent toujours l'historique complet, la fenêtre active y est surlignée.
- **Répartition des modèles** : camembert (`ModelDonut`) avec messages IN/OUT au survol,
  tokens & coût par modèle.
- **Coût par projet** (`ProjectCostList`) avec recherche/tri côté client.
- **Distribution horaire** des débuts de session (`HourlyDistribution` : 24 barres, heure
  **locale**, comptage brut par heure).
- **Outils / skills** les plus utilisés (`ToolUsageList`).
- **Stats de session** : moyennes, durées, ratio thinking/texte, projets récents.
- **Sessions épinglées** : les favoris (cf. store local), chacun relié à son transcript.
- **Abonnement** (`SubscriptionCard`) : compare le coût estimé de l'usage au prix du plan
  Claude (via `lib/subscription.ts`) pour afficher l'économie nette (détails du plan
  révélés au survol de la carte).

### Carte « Coût estimé » cliquable

La carte KPI « Coût estimé » (`CostStatCard`) bascule au clic entre le **coût d'usage
estimé** et l'**économie nette** réalisée grâce à l'abonnement. La valeur affichée par
défaut suit la préférence `costCardMode` (cf. Préférences).

### Sélecteur de fenêtre (`RangeSelector`)

Filtre les stats : `Tout` / `30 j` / `7 j`, un mois précis (`?range=month&month=YYYY-MM`)
ou une plage libre (`?range=custom&from=…&to=…`). `getAnalytics(sinceMs, untilMs)` prend
les deux bornes. Chaque carte KPI concernée (Messages, Tokens, Coût) affiche un **delta de
vélocité** : la variation vs la période précédente de même durée (N vs N-1, avec les dates
réelles de la période N-1) — masqué pour la fenêtre « Tout ».

> Le **coût est une estimation locale** (tarifs indicatifs par famille de modèle), pas une
> facturation réelle. Voir **Préférences → Tarifs d'estimation** dans la config.

## Autorisations d'écriture

Toute mutation de `~/.claude` est **conditionnée par une permission** du store
(ressource × action : create / modify / delete / reset). **Tout est `false` par défaut**
(verrou opt-in intégral) : l'app démarre en lecture seule et vous ouvrez explicitement ce
que vous l'autorisez à écrire, depuis **Préférences → Autorisations d'écriture**
(`PermissionsMatrix`). Le contrôle est fait **côté serveur** ; l'UI ne fait que refléter
l'état (bouton masqué, bannière « lecture seule »). Plugins & marketplaces en sont exclus
(restent lecture seule). Voir aussi [Sécurité](./securite.md).

## Skills

Liste, aperçu, **édition**, **création** (template pré-rempli) et **suppression** des
`~/.claude/skills/*/SKILL.md` (frontmatter YAML + corps markdown). Toute écriture crée
d'abord un **backup horodaté** `SKILL.md.bak.<timestamp>` à côté du fichier ; une
suppression déplace le dossier en **corbeille** (réversible). Chaque action est gated par
`skills.{create,modify,delete}`.

## Projets & Sessions

Navigation **en lecture seule** dans `~/.claude/projects/*/*.jsonl` (transcripts). Chaque
ligne JSONL est normalisée en blocs (`text`, `thinking`, `tool_use`, `tool_result`). La
page d'un projet affiche aussi ses statistiques agrégées (`getProjectStats`) au-dessus de
la liste des sessions.

- **Épinglage** : projets et sessions sont épinglables (`FavoriteButton` → store local) ;
  les projets épinglés remontent en tête de liste.
- **Reprise** : la page d'une session propose un `ResumeButton` qui **copie** la commande
  `claude --resume <sessionId>` dans le presse-papier (l'app n'exécute rien).
- **Export** : `ExportButton` télécharge une session ou un projet entier en **Markdown** ou
  en **HTML autonome** (`/api/export`, lecture seule, hors permissions). L'export projet
  reprend le rendu du site (KPI, modèles, top outils, liste de sessions) sous forme de
  mini-site autonome.
- **Suppression** : projets et sessions sont supprimables (déplacement en corbeille, via
  `/api/projects`) si la permission `projects.delete` est activée.

## Recherche full-text

Une **recherche** (`/search`, ouverte par le `SearchFab` visible sur `/projects`) balaie
**en lecture seule** tous les transcripts, ligne par ligne en streaming, casse et accents
ignorés. Elle scanne les blocs `text` par défaut (toggles pour `thinking` et `tool_result`),
groupe les résultats par session (récents d'abord) et surligne les extraits. Hors
permissions.

## Config Claude (section « Config »)

- **Préférences** (`/config/preferences`) : réglages **propres à claudeboard**, regroupés
  en une page — **Autorisations d'écriture** (`PermissionsMatrix`), **Tarifs d'estimation**
  (`PricingEditor`, overrides par famille + formule de coût), **Abonnement**
  (`SubscriptionSelector` : auto-détection depuis `~/.claude.json` ou plan manuel Pro /
  Max 5× / Max 20×), **Affichage** (`CostModeSelector` : valeur par défaut de la carte
  « Coût estimé ») et **Langue** (`LanguageSelector` : FR / EN).
- **Settings** : édition de `settings.json` et `settings.local.json` (JSON validé live +
  backup, création de `.local` à la demande) ; **réinitialisation** possible (`settings.reset`).
- **Hooks** : visualiseur groupé par event (fusion des deux settings) **et édition** du
  bloc `hooks` de `settings.json` si `hooks.modify` est activé (`settings.local.json` n'est
  pas touché).
- **Agents** (`~/.claude/agents/*`) et **Commandes** (`~/.claude/commands/**`) :
  liste/aperçu/**édition**/**création**/**suppression** sur le modèle des skills
  (sous-dossiers de commands = namespaces).
- **Graphe de dépendances** (`/config/graph`) : **lecture seule** — qui référence qui entre
  skills, agents et commandes (détection textuelle : `/commande`, `@agent`, nom en
  backticks), avec un layout force-dirigé côté client.
- **CLAUDE.md global** : éditeur markdown, création si absent, **réinitialisation** et
  **suppression**.
- **MCP servers** : **lecture seule** des serveurs de `~/.claude.json` + statut d'auth
  (valeurs d'`env` masquées).
- **Plugins & Marketplaces** : **lecture seule** des marketplaces et catalogues, KPI et
  plugins bloqués ; l'installation reste du ressort du CLI (`/plugin install …`, commande
  copiable). Volontairement **hors** du modèle d'autorisations.
- **Keybindings** (`~/.claude/keybindings.json`) : aperçu tabulaire + éditeur JSON,
  création si absent, **réinitialisation** et **suppression**.
- **Corbeille** (`/config/trash`) : les éléments supprimés depuis l'app, stockés **hors** de
  `~/.claude` (`data/trash/`). Chaque entrée est **restaurable** (refus si la cible existe)
  ou supprimable définitivement ; la corbeille peut être vidée. La restauration réutilise le
  `delete` de la ressource d'origine ; le vidage/suppression définitive est gated par
  `trash.empty`.
- **Structure du dossier** : arbre pédagogique du contenu de `.claude/`.

Les actions d'écriture ci-dessus sont toutes **gated** par la permission correspondante
(voir *Autorisations d'écriture*), et les **suppressions passent par la corbeille**
(réversibles).

## Thème

Bascule clair/sombre (`ThemeToggle` dans la Sidebar), persistée dans `localStorage` et
appliquée avant le premier rendu (pas de flash).
