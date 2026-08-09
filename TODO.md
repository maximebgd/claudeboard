⚙️ Config Claude au-delà des skills

- Éditeur de settings.json / settings.local.json (permissions, env, hooks) avec validation.
- Visualiseur de hooks : quels hooks tournent, sur quels events.
- Gestion des agents (~/.claude/agents/*) sur le même modèle que les skills.
- Gestion des commandes/slash custom.
- Éditeur de CLAUDE.md global et par projet.
- MCP servers : lister ceux configurés, leur statut.
- Keybindings viewer/éditeur.



🔍 Skills (déjà éditables — à enrichir)

- Création de skill depuis l'UI (un template SKILL.md pré-rempli) — aujourd'hui writeSkill refuse la création.
- Suppression / archivage d'un skill (avec backup).
- Recherche full-text dans tous les skills (nom + corps + description frontmatter).
- Validation live du frontmatter dans l'éditeur (nom, description obligatoires) avec preview côte à côte.
- Historique des backups .bak.* : lister, comparer (diff) et restaurer une version.
- Duplication d'un skill comme point de départ.
- Tags / catégories pour filtrer les skills.

💬 Projets & Sessions (lecture seule — à améliorer)

- Recherche globale dans tous les transcripts (« retrouve la session où j'ai parlé de X »).
- Filtres : par date, par modèle, par présence d'erreurs, par outil utilisé.
- Export d'une session en Markdown / JSON / HTML.
- Vue « diff » des blocs tool_use de type Edit/Write pour voir les changements de code appliqués.
- Repli/dépli des blocs thinking et des gros tool_result (déjà Collapsible dispo).
- Favoris / épingles sur des sessions marquantes.
- Fil de fer résumé : générer un résumé auto de la session (mais ça casserait le « pas de télémétrie/local »… sauf via un modèle local).

🎨 UX / Qualité de vie

- Recherche globale ⌘K (command palette) traversant skills + projets + sessions.
- Raccourcis clavier de navigation.
- Breadcrumbs dans les pages profondes (projet > session).
- Mode responsive / mobile.
- Copier-coller d'un bloc code depuis un transcript.
- Coloration syntaxique dans les blocs code (react-markdown + rehype-highlight/shiki).

🛠️ Technique / robustesse

- Tests (Vitest/Playwright) — il n'y en a pas encore.
- Gestion d'erreur propre si ~/.claude est absent (onboarding).
- Pagination / lazy-load des gros JSONL (les transcripts peuvent être énormes).
- Cache de parsing des sessions.
- Watcher FS pour rafraîchir en live (SSE / revalidation) plutôt que force-dynamic.

---

🟢 Le gros gain : stats-cache.json (déjà tout calculé !)

Ce fichier contient, pré-agrégé, de quoi faire tout ton dashboard TODO sans rien recalculer :
- dailyActivity (35 jours) → messages / sessions / tool calls par jour → heatmap d'activité
- dailyModelTokens → tokens par modèle par jour → graphe d'évolution empilé
- modelUsage → input/output/cache tokens + webSearchRequests + costUSD par modèle → camembert coûts & tokens
- hourCounts → histogramme "à quelle heure je code" (tu es à fond à 19h 😄)
- totalSessions (149), totalMessages (17205), longestSession, firstSessionDate, totalSpeculationTimeSavedMs → cartes de chiffres clés

👉 C'est LA feature à faire en premier : une page « Stats » qui lit ce JSON. Zéro parsing lourd, données fiables, gros impact visuel.

🟡 Autres sources exploitables

┌────────────────────────────────────────┬─────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│                 Source                 │                     Contenu                     │                      Feature possible                       │
├────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ history.jsonl (1646 lignes)            │ tous tes prompts + timestamp, project,          │ Historique/recherche de prompts, "mes prompts les plus      │
│                                        │ sessionId, pastedContents                       │ fréquents", nuage de mots                                   │
├────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ file-history/<uuid>/<hash>@vN          │ versions successives de fichiers édités par     │ Timeline des fichiers modifiés + diff entre versions        │
│                                        │ Claude                                          │                                                             │
├────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ jobs/<id>/state.json + timeline.jsonl  │ agents background (state: blocked/running,      │ Vue "Jobs / agents" : qui tourne, qui est bloqué et         │
│                                        │ needs, template)                                │ pourquoi                                                    │
├────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ settings.json (+ .bak, .orig)          │ model, statusLine, theme, voice, effortLevel    │ Éditeur de settings avec restauration des backups           │
├────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ plugins/*.json                         │ marketplaces connus, plugins installés (vide)   │ Vue plugins / marketplaces                                  │
├────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ skills/                                │ 3 skills (déjà géré)                            │ rien à changer                                              │
├────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ statusline-command.sh (+ .bak)         │ ton statusline custom (22 Ko)                   │ Viewer/éditeur du script statusline                         │
├────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ backups/.claude.json.backup.*          │ snapshots horodatés de la config globale        │ Explorateur de backups                                      │
├────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ session-env/, shell-snapshots/,        │ env par session, snapshots shell, presse-papier │ secondaire / debug                                          │
│ paste-cache/                           │                                                 │                                                             │
└────────────────────────────────────────┴─────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘

🎯 Ma reco de priorités

1. Page "Stats" / Dashboard à partir de stats-cache.json → ton TODO, énorme ratio impact/effort, données déjà prêtes.
2. Historique de prompts searchable depuis history.jsonl → très utile au quotidien.
3. Vue Jobs/agents depuis jobs/ → original, personne ne le montre.
4. Éditeur de settings.json avec backups → cohérent avec ta philosophie « édition + backup » déjà en place pour les skills.