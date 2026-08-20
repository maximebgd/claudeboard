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
- **Stats de session** : moyennes, durées (temps actif, cf. [Métriques &
  estimation](./metriques.md)), ratio thinking/texte, projets récents.
- **Sessions épinglées** : les favoris (cf. store local), chacun relié à son transcript.
- **Abonnement** (`SubscriptionCard`) : compare le coût estimé de l'usage au prix du plan
  Claude (via `lib/subscription.ts`) pour afficher l'économie nette (détails du plan
  révélés au survol de la carte).
- **Limites d'usage** : deux barres dans l'en-tête (fenêtres glissantes 5 h et 7 j) —
  nécessite une configuration du statusline, voir plus bas.

### Carte « Coût estimé » cliquable

La carte KPI « Coût estimé » (`CostStatCard`) bascule au clic entre le **coût d'usage
estimé** et l'**économie nette** réalisée grâce à l'abonnement. La valeur affichée par
défaut suit la préférence `costCardMode` (cf. Préférences).

### Sélecteur de fenêtre (`RangeSelector`)

Filtre les stats : `Tout` / `30 j` / `7 j`, puis un **bouton calendrier** unique qui
regroupe trois modes dans un popover à onglets :

- **Mois** : un mois calendaire précis (`?range=month&month=YYYY-MM`) ;
- **Période** : une plage libre (`?range=custom&from=…&to=…`) ;
- **Cycle** : un **cycle de facturation** de votre abonnement
  (`?range=cycle&cycle=<offset>`, `0` = cycle courant). Les bornes sont calées sur le jour
  d'anniversaire de la souscription (`sub.since`, cf. `lib/billingCycle.ts`) — p. ex. un abo
  facturé le 23 donne « 23 juil. → 23 août ». L'onglet n'apparaît **que** si la date
  d'abonnement est connue.

`getAnalytics(sinceMs, untilMs)` prend les deux bornes. Chaque carte KPI concernée
(Messages, Tokens, Coût) affiche un **delta de vélocité** : la variation vs la période
précédente de même durée (N vs N-1, avec les dates réelles de la période N-1) — masqué pour
la fenêtre « Tout ».

> Le **coût est une estimation locale** (tarifs indicatifs par famille de modèle), pas une
> facturation réelle. Détails du calcul (coût **et** durées) dans
> [Métriques & estimation](./metriques.md) ; tarifs éditables dans
> **Préférences → Tarifs d'estimation**.

### Limites d'usage (fenêtres 5 h / 7 j)

L'en-tête du dashboard affiche deux barres : la part consommée des fenêtres glissantes
**5 heures** et **7 jours** de votre abonnement Claude.ai, et le temps restant avant leur
réinitialisation.

> ⚙️ **Ces barres demandent une configuration de votre statusline.** Sans elle, le bandeau
> reste affiché mais avec des **jauges vides**, accompagnées d'une **alerte cliquable** qui
> renvoie vers la procédure ci-dessous.

**Pourquoi une configuration ?** Claude Code n'écrit ces pourcentages dans aucun fichier :
il ne les transmet qu'au script de statusline, dans le JSON qu'il lui envoie sur l'entrée
standard (champ `rate_limits`). Claudeboard ne peut donc pas les lire à la source. Il lit
une copie que le statusline doit déposer sur le disque, dans
`~/.claude/statusline-cache/rate-limits.env`.

**Comment faire.** Ajoutez ce bloc à votre `~/.claude/statusline-command.sh`. Il suppose
que le JSON reçu est déjà dans une variable `input` (typiquement `input=$(cat)` en tête de
script) et il a besoin de `jq` :

```bash
# Cache des limites d'usage, lu par claudeboard.
RATE_CACHE="$HOME/.claude/statusline-cache/rate-limits.env"
BLOCK_PCT=$(jq -r '.rate_limits.five_hour.used_percentage // -1 | floor' <<<"$input")
if [ "$BLOCK_PCT" -ge 0 ]; then
  mkdir -p "$(dirname "$RATE_CACHE")"
  jq -r '
    "BLOCK_PCT="        + (.rate_limits.five_hour.used_percentage  // -1 | floor | tostring),
    "RESET_EPOCH="      + (.rate_limits.five_hour.resets_at        //  0 | floor | tostring),
    "WEEK_PCT="         + (.rate_limits.seven_day.used_percentage  // -1 | floor | tostring),
    "WEEK_RESET_EPOCH=" + (.rate_limits.seven_day.resets_at        //  0 | floor | tostring)
  ' <<<"$input" > "$RATE_CACHE"
fi
```

Le `if` n'est pas décoratif : `rate_limits` n'est renseigné qu'**après le premier échange
API** d'une session. En début de session le champ est absent, le pourcentage vaut `-1`, et
sans ce test vous écraseriez un cache valide par des valeurs vides.

Le fichier produit tient en quatre lignes `CLÉ=valeur` (les dates de reset sont des epochs
en **secondes**) :

```
BLOCK_PCT=92
RESET_EPOCH=1787150400
WEEK_PCT=34
WEEK_RESET_EPOCH=1787583600
```

Rechargez la page : les barres apparaissent. Si rien ne change, vérifiez que le fichier
existe et que `jq` est installé.

**Ce que ces barres montrent exactement.** Les pourcentages datent du **dernier relevé**
d'une session Claude Code active, pas de l'instant présent : si vous n'avez pas ouvert
Claude Code depuis deux heures, ils ont deux heures. Le décompte avant réinitialisation
reste juste, lui, puisqu'il se calcule à partir de l'epoch de reset. Une fenêtre déjà
dépassée s'affiche « réinitialisée », sa consommation repartant de zéro.

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
`~/.claude/skills/*/SKILL.md` (frontmatter YAML + corps markdown). Toute écriture archive
d'abord la version précédente **hors** de `~/.claude` (dans `data/backups/`), restaurable
depuis le **panneau « Versions »** de l'éditeur ; une suppression déplace le dossier en
**corbeille** (réversible). Chaque action est gated par `skills.{create,modify,delete}`.

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
