# Contribuer à claudeboard

<p align="center">
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/🇬🇧_English-555555?style=for-the-badge" alt="English"></a>
  &nbsp;
  <a href="./CONTRIBUTING.fr.md"><img src="https://img.shields.io/badge/🇫🇷_Français-2ea44f?style=for-the-badge" alt="Français"></a>
</p>

Merci de prendre le temps de contribuer ! claudeboard est un projet communautaire indépendant, et les contributions de toute taille sont les bienvenues — rapports de bug, docs, traductions et code.

> ℹ️ claudeboard **n'est pas affilié à Anthropic**. C'est un dashboard local, majoritairement en lecture seule, pour la config Claude Code stockée dans `~/.claude`.

## Code de conduite

Ce projet suit son [Code de conduite](./CODE_OF_CONDUCT.md). En participant, vous vous engagez à le respecter. Merci de signaler tout comportement inacceptable en privé — voir le [Code de conduite](./CODE_OF_CONDUCT.md#enforcement) pour la marche à suivre.

## Comment contribuer

- **Signaler un bug** — ouvrez une [issue](https://github.com/maximebgd/claudeboard/issues) avec des étapes de reproduction claires.
- **Proposer une fonctionnalité** — ouvrez une issue décrivant le besoin avant d'écrire du code, pour valider l'approche ensemble.
- **Améliorer la doc** — le dossier `docs/`, les README (`README.md` / `README.fr.md`) et `AGENTS.md` acceptent volontiers les corrections.
- **Ajouter une traduction** — l'UI est bilingue (EN/FR) ; chaque chaîne visible vit dans `lib/i18n/translations.ts`.

## Démarrage

Prérequis : **Node.js 20+** et **npm**.

```bash
git clone https://github.com/maximebgd/claudeboard.git
cd claudeboard
npm install
npm run dev        # démarre le dashboard sur http://127.0.0.1:9400
```

L'app lit le vrai `~/.claude` de votre machine. Pour la faire pointer vers un dossier de test (recommandé pendant le développement) :

```bash
CLAUDE_DIR=/chemin/vers/fixture/.claude npm run dev
```

Avant d'ouvrir une PR :

```bash
npm run lint       # ESLint (next lint)
npm run build      # build de production — la référence pour « est-ce que ça marche »
```

> Vérifiez un changement avec `npm run build` — **pas** `npm run start`, qui occuperait le port et entrerait en conflit avec un `npm run dev` en cours.

## Conventions du projet

Lisez d'abord [`AGENTS.md`](./AGENTS.md) — il documente l'architecture et les règles non négociables. Les principales :

- **Next.js 16 (App Router)** — `params` est une `Promise` (`await params` avant de le lire). Toute page qui touche le système de fichiers doit déclarer `export const dynamic = "force-dynamic"`. Consultez les guides de `node_modules/next/dist/docs/` avant d'écrire du code framework ; cette version de Next comporte des ruptures.
- **La sécurité d'abord** — tout accès fichier passe par `safeResolve(...)` (garde anti-traversée, tout reste dans `CLAUDE_DIR`). Seules exceptions : les lectures **seules** et ciblées de `~/.claude.json` (`mcp.ts`, `subscription.ts`, `plugins.ts`).
- **L'écriture n'est jamais silencieuse** — un écrasement crée toujours un backup horodaté `.bak`. Les suppressions ne sont **jamais destructives** : elles passent par `moveToTrash` vers `data/trash/` (hors de `~/.claude`) et sont restaurables.
- **Permissions** — toute mutation de `~/.claude` est gated côté serveur par `isAllowed(resource, action)` (403 sinon). Ajouter une action d'écriture ⇒ l'ajouter à `PERMISSION_SCHEMA` **et** la garder derrière `isAllowed`. Tout est `false` par défaut.
- **État claudeboard vs config Claude** — les données qui n'appartiennent pas à Claude (favoris, tarifs, abonnement, permissions, préférences) vivent dans `data/claudeboard.json`, jamais mélangées aux fichiers de `~/.claude`.
- **i18n (EN/FR)** — toute nouvelle chaîne visible exige une clé dans `fr` **et** `en` de `lib/i18n/translations.ts`. Une traduction anglaise manquante est une **erreur de compilation**. Gardez `lib/i18n/core.ts` isomorphe (aucune lecture FS/store).

## Commits & pull requests

- Utilisez les **[Conventional Commits](https://www.conventionalcommits.org/)**, ex. `feat(search): highlight tool_result matches` ou `fix(analytics): correct streak off-by-one`.
- Gardez les PR ciblées : un changement logique par PR. Rebasez sur `main` et assurez-vous que `npm run lint` et `npm run build` passent.
- Remplissez le template de pull request, décrivez **ce qui** change et **pourquoi**, et ajoutez des captures pour les changements d'UI.
- Référencez l'issue liée (`Closes #123`).

## Signaler une faille de sécurité

N'ouvrez **pas** d'issue publique pour un problème de sécurité. Voir [`SECURITY.md`](./SECURITY.md) pour un signalement privé.

## Licence

En contribuant, vous acceptez que vos contributions soient publiées sous la [licence MIT](./LICENSE) qui couvre le projet.
