# claudeboard v0.1.0

Un dashboard **local** pour analyser, parcourir et éditer la configuration Claude Code stockée dans `~/.claude`. Construit avec **Next.js 16** et **React 19**, il tourne uniquement sur `localhost` — pas de déploiement, pas de télémétrie, pas de cloud.

## ✨ Au menu

- **Dashboard analytics** — KPI (projets, sessions, messages, tokens, coût estimé), panneau d'activité (heatmap 12 mois ⇆ courbe des messages/jour + streak), répartition tokens/coût par modèle, coût par projet, distribution horaire, top outils/skills. Filtres par période (tout / 30 j / 7 j / mois / plage libre) avec delta de vélocité N vs N-1.
- **Limites d'usage** — bandeau dans l'en-tête du dashboard avec les deux fenêtres glissantes de ton abonnement Claude.ai (**5 h** et **7 j**) : % consommé et compte à rebours avant reset. Lecture seule, **hors temps réel** (dernier relevé d'une session active), via le cache du statusline. Demande un petit réglage du statusline ; sans lui, les jauges restent vides et pointent vers la doc de configuration.
- **Skills, agents & commandes** — liste, aperçu, édition, création et suppression. Chaque save archive la version précédente dans un panneau **Versions** restaurable (hors de `~/.claude`) ; sous-dossiers = namespaces pour agents/commandes.
- **Projets & sessions** — navigation lecture seule des transcripts JSONL, épinglage, bouton resume, export Markdown / HTML autonome.
- **Recherche full-text** — sur tous les transcripts, insensible à la casse et aux accents, extraits surlignés, groupés par session.
- **CLAUDE.md global** — éditeur markdown du `~/.claude/CLAUDE.md`, avec création / reset / suppression.
- **Graphe de dépendances** — qui référence qui entre skills, agents et commandes (détection des `/commande`, `@agent`, backticks), en layout force-dirigé. Lecture seule.
- **Settings Claude** — édition de `settings.json` et `settings.local.json` (JSON validé en direct + backup, création du `.local` à la demande, reset).
- **Hooks** — visualiseur groupé par event (fusion des deux settings) et édition du bloc `hooks` de `settings.json`.
- **MCP servers** — vue lecture seule des serveurs de `~/.claude.json` (globaux + par projet) avec statut d'auth ; valeurs `env` masquées.
- **Plugins & Marketplaces** — vue lecture seule des marketplaces, catalogues et usage ; la commande `/plugin install` est copiable mais jamais exécutée (l'install reste au CLI).
- **Keybindings** — aperçu tabulaire + éditeur JSON de `~/.claude/keybindings.json`, avec création / reset / suppression.
- **Versionnage** — chaque save d'un skill, agent, commande, ou de `settings.json` / du bloc hooks / du `CLAUDE.md` global / des keybindings archive la version précédente dans un panneau **Versions** (hors de `~/.claude`, pour ne pas polluer le dossier). Historique restaurable en un clic, diff façon `git diff` vs le fichier actuel, badge « Actuelle » sur la version en place, suppression d'une version, historique plafonné aux N dernières par cible.
- **Corbeille** — toutes les suppressions sont réversibles : au lieu d'effacer, l'app déplace l'élément vers `data/trash/` (hors de `~/.claude`). Depuis la corbeille, on restaure (refus si la cible existe déjà) ou on supprime définitivement, et on peut la vider.
- **Documentation intégrée** (`/docs`) — rend les fichiers `.md` du dossier `docs/` avec sommaire latéral, plus un arbre pédagogique de `.claude`. Les mêmes docs sont lisibles sur GitHub et dans l'app.
- **UI bilingue FR / EN**, thème clair/sombre sans flash.

## 🎛️ Ce qu'on peut faire dans `~/.claude`

Tout ce qui est modifiable est **désactivé par défaut**, à activer dans **Préférences → Autorisations d'écriture**.

| Ressource | Voir | Éditer | Créer | Supprimer |
|---|:-:|:-:|:-:|:-:|
| Skills · Agents · Commandes | ✅ | ✅ | ✅ | ✅ |
| settings · settings.local · hooks · CLAUDE.md · keybindings | ✅ | ✅ | ✅¹ | ✅ |
| Projets & sessions | ✅ | — | — | ✅ |
| MCP · Plugins · Recherche · Graphe | ✅ | — | — | — |

¹ Création explicite et seulement là où ça a du sens : `settings.local.json`, `keybindings.json`, le `CLAUDE.md` global.

**Rien n'est jamais perdu — un historique de versions + une corbeille, tous deux hors de `~/.claude` :**

- **Éditer un skill / agent / commande** → la version précédente est archivée **hors** de `~/.claude`, dans `data/backups/` → panneau **Versions** restaurable.
- **Éditer un fichier de config** (settings, hooks, CLAUDE.md, keybindings) → même mécanisme : version précédente archivée dans `data/backups/` → panneau **Versions** restaurable (diff façon `git diff`, badge « Actuelle », 10 versions max par cible).
- **Toute suppression** (tout ce qui précède + projets/sessions) → part en **corbeille** (`data/trash/`, hors de `~/.claude`), restaurable et jamais effacée.

## 🔒 Sécurité & confidentialité

- **100 % local** — aucun appel réseau avec tes données, serveur lié à `127.0.0.1` uniquement.
- **Read-only par défaut** — chaque écriture est gated par une permission opt-in (tout désactivé au départ), contrôlée côté serveur.
- **Écritures réversibles** — historique de versions restaurable à chaque save (config comme skills/agents/commandes, tout archivé hors de `~/.claude` dans `data/backups/`), suppressions déplacées vers la corbeille (jamais effacées).
- **Accès lecture seule** à `~/.claude`, lecture-écriture limitée au dossier du projet.

## 🚀 Démarrer

```bash
git clone https://github.com/maximebgd/claudeboard
cd claudeboard
npm install
npm run dev   # http://127.0.0.1:9400
```

---

> ⚠️ **Projet indépendant, non affilié à Anthropic.** « Claude » n'est mentionné que pour décrire ce que l'outil lit.

Licence : **MIT** © Maxime Bégoud
