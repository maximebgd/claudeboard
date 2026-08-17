import type { ReactNode } from "react";
import { A, C, type TreeNode } from "./directoryTreeShared";

/*
 * Contenu **français** de l'explorateur de structure `.claude` (source de vérité).
 * Pur jeu de données JSX : deux arbres (`PROJECT_TREE`, `GLOBAL_TREE`) de `TreeNode`.
 * La variante anglaise vit dans `directoryTree.en.tsx` ; `DirectoryExplorer` choisit
 * selon la langue. Voir `directoryTreeShared` pour le type et les helpers `A`/`C`.
 */

export const commandsNote: ReactNode = (
  <>
    Les commandes et les skills reposent désormais sur le même mécanisme. Pour
    tout nouveau workflow, préfère un <A href="/en/skills">skill</A> : même
    invocation <C>/name</C>, et tu peux en plus embarquer des fichiers de
    support.
  </>
);

export const PROJECT_TREE: TreeNode = {
  id: "project-root",
  label: "your-project/",
  type: "folder",
  icon: "folder",
  color: "var(--ce-accent)",
  children: [
    {
      id: "claude-md",
      label: "CLAUDE.md",
      type: "file",
      icon: "md",
      color: "#6A9BCC",
      badge: "committed",
      oneLiner: "Instructions de projet lues à chaque session",
      when: "Chargé dans le contexte au début de chaque session",
      description:
        "Instructions spécifiques au projet qui cadrent la façon dont Claude travaille dans ce dépôt. Mets-y tes conventions, les commandes courantes et le contexte d'architecture pour que Claude parte des mêmes hypothèses que ton équipe.",
      tips: [
        "Vise moins de 200 lignes. Les fichiers plus longs se chargent quand même en entier mais peuvent réduire l'adhérence",
        <>
          CLAUDE.md se charge à chaque session. Si quelque chose ne concerne que
          certaines tâches, déplace-le dans un <A href="/en/skills">skill</A> ou
          une <A href="/en/memory#organize-rules-with-claude/rules/">rule</A>{" "}
          scopée par chemin, pour qu'il ne se charge qu'au besoin
        </>,
        "Liste les commandes que tu lances le plus (build, test, format) pour que Claude les connaisse sans avoir à les répéter",
        <>
          Lance <C>/memory</C> pour ouvrir et éditer CLAUDE.md depuis une session
        </>,
        <>
          Fonctionne aussi à <C>.claude/CLAUDE.md</C> si tu préfères garder la
          racine du projet propre
        </>,
      ],
      exampleIntro:
        "Cet exemple vise un projet TypeScript + React. Il liste les commandes de build et de test, les conventions du framework que Claude doit suivre, et des règles propres au projet comme le style d'export et l'organisation des fichiers.",
      example: `# Project conventions

## Commands
- Build: \`npm run build\`
- Test: \`npm test\`
- Lint: \`npm run lint\`

## Stack
- TypeScript with strict mode
- React 19, functional components only

## Rules
- Named exports, never default exports
- Tests live next to source: \`foo.ts\` -> \`foo.test.ts\`
- All API routes return \`{ data, error }\` shape`,
      docsLink: "/en/memory",
    },
    {
      id: "mcp-json",
      label: ".mcp.json",
      type: "file",
      icon: "json",
      color: "#9B7BC4",
      badge: "committed",
      oneLiner: "Serveurs MCP du projet, partagés avec l'équipe",
      when: (
        <>
          Les serveurs se connectent au démarrage de la session. Les schémas
          d'outils sont différés par défaut et chargés à la demande via{" "}
          <A href="/en/mcp#scale-with-mcp-tool-search">tool search</A>
        </>
      ),
      description: (
        <>
          Configure les serveurs Model Context Protocol (MCP) qui donnent à
          Claude accès à des outils externes : bases de données, API,
          navigateurs, etc. Ce fichier contient les serveurs scopés au projet que
          toute l'équipe utilise. Les serveurs personnels que tu veux garder pour
          toi vont plutôt dans <C>~/.claude.json</C>.
        </>
      ),
      tips: [
        <>
          Utilise des références de variables d'environnement pour les secrets :{" "}
          <C>{"${NOTION_TOKEN}"}</C>
        </>,
        <>
          Se trouve à la racine du projet, pas dans <C>.claude/</C>
        </>,
        <>
          Pour un serveur qui ne concerne que toi, lance{" "}
          <C>claude mcp add --scope user</C>. Ça écrit dans <C>~/.claude.json</C>{" "}
          plutôt que dans <C>.mcp.json</C>
        </>,
      ],
      exampleIntro: (
        <>
          Cet exemple configure le serveur MCP Notion pour que Claude puisse lire
          et mettre à jour des pages de ton espace. La référence{" "}
          <C>{"${NOTION_TOKEN}"}</C> est lue depuis l'environnement du shell au
          démarrage de Claude Code, donc le token ne se retrouve jamais dans le
          fichier.
        </>
      ),
      example: `{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "NOTION_TOKEN": "\${NOTION_TOKEN}"
      }
    }
  }
}`,
      docsLink: "/en/mcp",
    },
    {
      id: "worktreeinclude",
      label: ".worktreeinclude",
      type: "file",
      icon: "md",
      color: "#8FA876",
      badge: "committed",
      oneLiner: "Fichiers gitignorés à copier dans les nouveaux worktrees",
      when: (
        <>
          Lu quand Claude crée un worktree git via <C>--worktree</C>, l'outil{" "}
          <C>EnterWorktree</C>, ou un sous-agent en{" "}
          <C>isolation: worktree</C>
        </>
      ),
      description: (
        <>
          Liste les fichiers gitignorés à copier depuis ton dépôt principal vers
          chaque nouveau worktree. Les worktrees sont des checkouts vierges,
          donc les fichiers non suivis comme <C>.env</C> manquent par défaut. Les
          motifs suivent la syntaxe <C>.gitignore</C>. Seuls les fichiers qui
          matchent un motif <em>et</em> sont aussi gitignorés sont copiés, donc
          les fichiers suivis ne sont jamais dupliqués.
        </>
      ),
      tips: [
        <>
          Se trouve à la racine du projet, pas dans <C>.claude/</C>
        </>,
        <>
          Git uniquement : si tu configures un{" "}
          <A href="/en/hooks#worktreecreate">hook WorktreeCreate</A> pour un
          autre VCS, ce fichier n'est pas lu. Copie les fichiers dans ton script
          de hook à la place
        </>,
        <>
          S'applique aussi aux sessions parallèles de l'
          <A href="/en/desktop#work-in-parallel-with-sessions">app desktop</A>
        </>,
      ],
      exampleIntro:
        "Cet exemple copie tes fichiers d'environnement locaux et une config de secrets dans chaque worktree créé par Claude. Les commentaires commencent par # et les lignes vides sont ignorées, comme dans .gitignore.",
      example: `# Local environment
.env
.env.local

# API credentials
config/secrets.json`,
      docsLink: "/en/worktrees#copy-gitignored-files-into-worktrees",
    },
    {
      id: "dot-claude",
      label: ".claude/",
      type: "folder",
      icon: "folder",
      color: "var(--ce-accent)",
      oneLiner: "Configuration, règles et extensions au niveau projet",
      description:
        "Tout ce que Claude Code lit qui est spécifique à ce projet. Si tu utilises git, commit la plupart des fichiers d'ici pour les partager avec ton équipe ; quelques-uns, comme settings.local.json, sont gitignorés quand Claude Code y écrit des réglages. Le badge de chaque fichier indique lequel.",
      children: [
        {
          id: "settings-json",
          label: "settings.json",
          type: "file",
          icon: "json",
          color: "var(--ce-text-3)",
          badge: "committed",
          oneLiner: "Permissions, hooks et configuration",
          when: (
            <>
              Surcharge le <C>~/.claude/settings.json</C> global. Les settings
              locaux, les flags CLI et les managed settings surchargent celui-ci
            </>
          ),
          description:
            "Réglages que Claude Code applique directement. Les permissions contrôlent quelles commandes et quels outils Claude peut utiliser ; les hooks lancent tes scripts à des moments précis d'une session. Contrairement à CLAUDE.md, que Claude lit comme une consigne, ceux-ci sont appliqués que Claude les suive ou non.",
          contains: [
            <>
              <A href="/en/permissions">permissions</A> : autorise, refuse ou
              demande avant que Claude n'utilise certains outils ou commandes
            </>,
            <>
              <A href="/en/hooks">hooks</A> : lance tes propres scripts sur des
              événements (avant un appel d'outil, après une édition de fichier…)
            </>,
            <>
              <A href="/en/statusline">statusLine</A> : personnalise la ligne
              affichée en bas pendant que Claude travaille
            </>,
            <>
              <A href="/en/settings#available-settings">model</A> : choisis un
              modèle par défaut pour ce projet
            </>,
            <>
              <A href="/en/settings#environment-variables">env</A> : variables
              d'environnement définies dans chaque session
            </>,
            <>
              <A href="/en/output-styles">outputStyle</A> : sélectionne un style
              de system-prompt personnalisé depuis output-styles/
            </>,
          ],
          tips: [
            <>
              Les motifs de permission Bash acceptent les jokers :{" "}
              <C>Bash(npm test *)</C> matche toute commande commençant par{" "}
              <C>npm test</C>
            </>,
            <>
              Les réglages en tableau comme <C>permissions.allow</C> se
              combinent entre tous les scopes ; les réglages scalaires comme{" "}
              <C>model</C> prennent la valeur la plus spécifique
            </>,
          ],
          exampleIntro: (
            <>
              Cet exemple autorise <C>npm test</C> et <C>npm run</C> sans
              demander, bloque <C>rm -rf</C>, et lance Prettier sur les fichiers
              après que Claude les a édités ou créés.
            </>
          ),
          example: `{
  "permissions": {
    "allow": [
      "Bash(npm test *)",
      "Bash(npm run *)"
    ],
    "deny": [
      "Bash(rm -rf *)"
    ]
  },
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
      }]
    }]
  }
}`,
          docsLink: "/en/settings",
        },
        {
          id: "settings-local-json",
          label: "settings.local.json",
          type: "file",
          icon: "json",
          color: "var(--ce-text-3)",
          badge: "gitignored",
          oneLiner: "Tes réglages personnels pour ce projet",
          when: "Le plus prioritaire des fichiers de settings éditables par l'utilisateur ; les flags CLI et les managed settings priment quand même",
          description:
            "Réglages personnels qui priment sur les valeurs par défaut du projet. Même format JSON que settings.json, gitignoré quand Claude Code y enregistre un réglage. À utiliser quand tu as besoin de permissions ou de défauts différents de la config d'équipe.",
          tips: [
            <>
              Même schéma que settings.json. Les réglages en tableau comme{" "}
              <C>permissions.allow</C> se combinent entre les scopes ; les
              réglages scalaires comme <C>model</C> prennent la valeur locale
            </>,
            <>
              Quand Claude Code enregistre un réglage dans ce fichier dans un
              dépôt qui ne l'ignore pas déjà, il ajoute{" "}
              <C>**/.claude/settings.local.json</C> à ton fichier d'exclusions
              git global. Pour partager la règle d'ignore avec ton équipe,
              ajoute-la aussi au <C>.gitignore</C> du projet
            </>,
          ],
          exampleIntro:
            "Cet exemple ajoute des permissions Docker par-dessus ce que le settings.json d'équipe autorise déjà.",
          example: `{
  "permissions": {
    "allow": [
      "Bash(docker *)"
    ]
  }
}`,
          docsLink: "/en/settings",
        },
        {
          id: "rules",
          label: "rules/",
          type: "folder",
          icon: "folder",
          color: "#9B7BC4",
          oneLiner: "Instructions par thème, optionnellement filtrées par chemin",
          when: (
            <>
              Les rules sans <C>paths:</C> se chargent au début de session.
              Celles avec <C>paths:</C> se chargent quand un fichier matchant
              entre dans le contexte
            </>
          ),
          description: [
            <>
              Instructions de projet découpées en fichiers thématiques qui
              peuvent se charger conditionnellement selon les chemins de
              fichiers. Une rule sans frontmatter <C>paths:</C> se charge au
              début de session comme CLAUDE.md ; une rule avec <C>paths:</C> ne
              se charge que quand Claude lit un fichier matchant.
            </>,
            <>
              Comme CLAUDE.md, les rules sont des consignes que Claude lit, pas
              de la configuration appliquée par Claude Code. Pour un comportement
              garanti, utilise des <A href="/en/hooks">hooks</A> ou des{" "}
              <A href="/en/permissions">permissions</A>.
            </>,
          ],
          tips: [
            <>
              Utilise le frontmatter <C>paths:</C> avec des globs pour scoper une
              rule à des répertoires ou types de fichiers
            </>,
            <>
              Les sous-dossiers fonctionnent :{" "}
              <C>.claude/rules/frontend/react.md</C> est découvert
              automatiquement
            </>,
            "Quand CLAUDE.md approche des 200 lignes, commence à découper en rules",
          ],
          docsLink: "/en/memory#organize-rules-with-claude/rules/",
          children: [
            {
              id: "rule-testing",
              label: "testing.md",
              type: "file",
              icon: "md",
              color: "#9B7BC4",
              badge: "committed",
              oneLiner: "Conventions de test scopées aux fichiers de test",
              when: (
                <>
                  Chargé quand Claude lit un fichier matchant les globs{" "}
                  <C>paths:</C> ci-dessous
                </>
              ),
              description: (
                <>
                  Une rule d'exemple qui ne se charge que quand Claude travaille
                  sur des fichiers de test. Les globs <C>paths:</C> du
                  frontmatter définissent quels fichiers la déclenchent ; ici,
                  tout ce qui finit en .test.ts ou .test.tsx. Pour les autres
                  fichiers, cette rule n'est pas chargée dans le contexte.
                </>
              ),
              example: `---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
---

# Testing Rules

- Use descriptive test names: "should [expected] when [condition]"
- Mock external dependencies, not internal modules
- Clean up side effects in afterEach`,
            },
            {
              id: "rule-api",
              label: "api-design.md",
              type: "file",
              icon: "md",
              color: "#9B7BC4",
              badge: "committed",
              oneLiner: "Conventions d'API scopées au code backend",
              when: (
                <>
                  Chargé quand Claude lit un fichier matchant le glob{" "}
                  <C>paths:</C> ci-dessous
                </>
              ),
              description: (
                <>
                  Un second exemple montrant une rule scopée au code backend. Le
                  glob <C>paths:</C> matche les fichiers sous src/api/, donc ces
                  conventions ne se chargent que quand Claude édite des routes
                  d'API.
                </>
              ),
              example: `---
paths:
  - "src/api/**/*.ts"
---

# API Design Rules

- All endpoints must validate input with Zod schemas
- Return shape: { data: T } | { error: string }
- Rate limit all public endpoints`,
            },
          ],
        },
        {
          id: "skills",
          label: "skills/",
          type: "folder",
          icon: "folder",
          color: "#D4A843",
          oneLiner: "Prompts réutilisables invoqués par nom, par toi ou Claude",
          when: (
            <>
              Invoqué avec <C>/skill-name</C> ou quand Claude associe la tâche à
              un skill
            </>
          ),
          description: (
            <>
              Chaque skill est un dossier avec un fichier SKILL.md plus les
              fichiers de support dont il a besoin. Par défaut, toi comme Claude
              pouvez invoquer un skill. Le frontmatter permet de contrôler ça :{" "}
              <C>disable-model-invocation: true</C> pour un workflow réservé à
              l'utilisateur comme <C>/deploy</C>, ou <C>user-invocable: false</C>{" "}
              pour le cacher du menu <C>/</C> tout en laissant Claude l'invoquer.
            </>
          ),
          tips: [
            <>
              Les skills acceptent des arguments : <C>/deploy staging</C> passe
              «&nbsp;staging&nbsp;» comme <C>$ARGUMENTS</C>. Utilise <C>$0</C>,{" "}
              <C>$1</C>, etc. pour l'accès positionnel
            </>,
            <>
              Le frontmatter <C>description</C> détermine quand Claude
              auto-invoque le skill
            </>,
            "Embarque des docs de référence à côté de SKILL.md. Claude connaît le chemin du dossier du skill et peut lire les fichiers de support quand tu les mentionnes",
          ],
          docsLink: "/en/skills",
          children: [
            {
              id: "skill-review",
              label: "security-review/",
              type: "folder",
              icon: "folder",
              color: "#D4A843",
              oneLiner: "Un skill regroupant SKILL.md et ses fichiers de support",
              children: [
                {
                  id: "skill-review-md",
                  label: "SKILL.md",
                  type: "file",
                  icon: "md",
                  color: "#D4A843",
                  badge: "committed",
                  oneLiner: "Point d'entrée : déclencheur, invocabilité, consignes",
                  when: (
                    <>
                      L'utilisateur tape{" "}
                      <C>/security-review &lt;target&gt;</C> ; Claude ne peut pas
                      auto-invoquer ce skill
                    </>
                  ),
                  description: [
                    <>
                      Ce skill utilise <C>disable-model-invocation: true</C> pour
                      que seul toi puisses le déclencher ; Claude ne l'invoque
                      jamais de lui-même.
                    </>,
                    <>
                      La ligne <C>!`...`</C> exécute une commande shell et injecte
                      sa sortie dans le prompt. <C>$ARGUMENTS</C> substitue ce que
                      tu as tapé après le nom du skill. Claude voit le chemin du
                      dossier du skill, donc mentionner un fichier embarqué comme
                      checklist.md lui permet de le lire.
                    </>,
                  ],
                  example: `---
description: Reviews code changes for security vulnerabilities, authentication gaps, and injection risks
disable-model-invocation: true
argument-hint: <branch-or-path>
---

## Diff to review

!\`git diff $ARGUMENTS\`

Audit the changes above for:

1. Injection vulnerabilities (SQL, XSS, command)
2. Authentication and authorization gaps
3. Hardcoded secrets or credentials

Use checklist.md in this skill directory for the full review checklist.

Report findings with severity ratings and remediation steps.`,
                },
                {
                  id: "skill-checklist",
                  label: "checklist.md",
                  type: "file",
                  icon: "md",
                  color: "#D4A843",
                  badge: "committed",
                  oneLiner: "Fichier de support embarqué avec le skill",
                  when: "Claude le lit à la demande pendant l'exécution du skill",
                  description: (
                    <>
                      Les skills peuvent embarquer n'importe quel fichier de
                      support : docs de référence, templates, scripts. Le chemin
                      du dossier du skill est ajouté en tête de SKILL.md, donc
                      Claude peut lire les fichiers embarqués par leur nom. Pour
                      les scripts dans les commandes d'injection bash, utilise le
                      placeholder <C>{"${CLAUDE_SKILL_DIR}"}</C>.
                    </>
                  ),
                  example: `# Security Review Checklist

## Input Validation
- [ ] All user input sanitized before DB queries
- [ ] File upload MIME types validated
- [ ] Path traversal prevented on file operations

## Authentication
- [ ] JWT tokens expire after 24 hours
- [ ] API keys stored in environment variables
- [ ] Passwords hashed with bcrypt or argon2`,
                },
              ],
            },
          ],
        },
        {
          id: "commands",
          label: "commands/",
          type: "folder",
          icon: "folder",
          color: "#788C5D",
          oneLiner: (
            <>
              Prompts sur un seul fichier invoqués avec <C>/name</C>
            </>
          ),
          note: commandsNote,
          when: (
            <>
              L'utilisateur tape <C>/command-name</C>
            </>
          ),
          description: (
            <>
              Un fichier <C>commands/deploy.md</C> crée <C>/deploy</C> de la même
              manière qu'un skill <C>skills/deploy/SKILL.md</C>, et les deux
              peuvent être auto-invoqués par Claude. Les skills utilisent un
              dossier avec SKILL.md, ce qui te permet d'embarquer docs de
              référence, templates ou scripts à côté du prompt.
            </>
          ),
          tips: [
            <>
              Utilise <C>$ARGUMENTS</C> dans le fichier pour accepter des
              paramètres : <C>/fix-issue 123</C>
            </>,
            "Si un skill et une commande partagent un nom, le skill a la priorité",
            "Les nouvelles commandes devraient plutôt être des skills ; les commandes restent supportées",
          ],
          docsLink: "/en/skills",
          children: [
            {
              id: "cmd-example",
              label: "fix-issue.md",
              type: "file",
              icon: "md",
              color: "#788C5D",
              badge: "committed",
              oneLiner: (
                <>
                  Invoqué avec <C>/fix-issue &lt;number&gt;</C>
                </>
              ),
              note: commandsNote,
              description: [
                <>
                  Une commande d'exemple pour corriger une issue GitHub. Tape{" "}
                  <C>/fix-issue 123</C> et la ligne <C>!`...`</C> lance{" "}
                  <C>gh issue view 123</C> dans ton shell, injectant la sortie
                  dans le prompt avant que Claude ne la voie.
                </>,
                <>
                  <C>$ARGUMENTS</C> substitue ce que tu as tapé après le nom de
                  la commande. Pour l'accès positionnel, utilise <C>$0</C>{" "}
                  <C>$1</C>, etc.
                </>,
              ],
              example: `---
argument-hint: <issue-number>
---

!\`gh issue view $ARGUMENTS\`

Investigate and fix the issue above.

1. Trace the bug to its root cause
2. Implement the fix
3. Write or update tests
4. Summarize what you changed and why`,
            },
          ],
        },
        {
          id: "output-styles",
          label: "output-styles/",
          type: "folder",
          icon: "folder",
          color: "#5AA7A7",
          oneLiner: "Output styles du projet, si l'équipe en partage",
          when: "Appliqué au début de session quand sélectionné via le réglage outputStyle",
          description: (
            <>
              Les output styles sont en général personnels, donc la plupart
              vivent dans <C>~/.claude/output-styles/</C>. Mets-en un ici si ton
              équipe partage un style, par exemple un mode revue que tout le
              monde utilise. Voir l'onglet Global pour l'explication complète et
              un exemple.
            </>
          ),
          docsLink: "/en/output-styles",
          children: [],
        },
        {
          id: "agents",
          label: "agents/",
          type: "folder",
          icon: "folder",
          color: "#C46686",
          oneLiner: "Sous-agents spécialisés avec leur propre fenêtre de contexte",
          when: "S'exécute dans sa propre fenêtre de contexte quand toi ou Claude l'invoque",
          description:
            "Chaque fichier markdown définit un sous-agent avec son propre system prompt, son accès aux outils et éventuellement son propre modèle. Les sous-agents tournent dans une fenêtre de contexte vierge, ce qui garde la conversation principale propre. Utile pour le travail en parallèle ou les tâches isolées.",
          tips: [
            "Chaque agent a une fenêtre de contexte vierge, séparée de ta session principale",
            <>
              Restreins l'accès aux outils par agent avec le champ de frontmatter{" "}
              <C>tools:</C>
            </>,
            "Tape @ et choisis un agent dans l'autocomplétion pour déléguer directement",
          ],
          docsLink: "/en/sub-agents",
          children: [
            {
              id: "agent-reviewer",
              label: "code-reviewer.md",
              type: "file",
              icon: "md",
              color: "#C46686",
              badge: "committed",
              oneLiner: "Sous-agent pour une revue de code isolée",
              when: "Claude le lance pour des tâches de revue, ou tu le @-mentionnes depuis l'autocomplétion",
              description: (
                <>
                  Un sous-agent d'exemple restreint aux outils en lecture seule.
                  Le frontmatter <C>description</C> indique à Claude quand lui
                  déléguer automatiquement ; <C>tools:</C> le limite à Read, Grep
                  et Glob pour qu'il puisse inspecter le code sans jamais
                  l'éditer. Le corps devient le system prompt du sous-agent.
                </>
              ),
              example: `---
name: code-reviewer
description: Reviews code for correctness, security, and maintainability
tools: Read, Grep, Glob
---

You are a senior code reviewer. Review for:

1. Correctness: logic errors, edge cases, null handling
2. Security: injection, auth bypass, data exposure
3. Maintainability: naming, complexity, duplication

Every finding must include a concrete fix.`,
            },
          ],
        },
        {
          id: "workflows",
          label: "workflows/",
          type: "folder",
          icon: "folder",
          color: "#C46686",
          oneLiner: "Scripts de workflow dynamiques qui orchestrent des sous-agents",
          when: "Chargé au démarrage ; chaque fichier devient une commande /<name>",
          description: (
            <>
              Chaque fichier <C>.js</C> est un{" "}
              <A href="/en/workflows">workflow dynamique</A> : un script que le
              runtime exécute pour lancer et coordonner plusieurs sous-agents.
              Les workflows sont écrits par Claude et enregistrés ici depuis{" "}
              <C>/workflows</C> plutôt qu'écrits à la main.
            </>
          ),
          tips: [
            <>
              Enregistre un run depuis <C>/workflows</C> avec <C>s</C> pour en
              créer un
            </>,
            <>
              Un workflow de projet prime sur un workflow personnel dans{" "}
              <C>~/.claude/workflows/</C> du même nom
            </>,
          ],
          docsLink: "/en/workflows",
        },
        {
          id: "agent-memory",
          label: "agent-memory/",
          type: "folder",
          icon: "folder",
          color: "#C46686",
          badge: "committed",
          autogen: true,
          oneLiner:
            "Mémoire persistante des sous-agents, distincte de l'auto-mémoire de session",
          when: "Les 200 premières lignes (plafond 25 Ko) de MEMORY.md chargées dans le system prompt du sous-agent quand il tourne",
          description: (
            <>
              Les sous-agents avec <C>memory: project</C> dans leur frontmatter
              obtiennent un dossier de mémoire dédié ici. C'est distinct de ton{" "}
              <A href="/en/memory#auto-memory">auto-mémoire de session
              principale</A>{" "}
              dans <C>~/.claude/projects/</C> : chaque sous-agent lit et écrit
              son propre MEMORY.md, pas le tien.
            </>
          ),
          tips: [
            <>
              Créé uniquement pour les sous-agents qui définissent le champ de
              frontmatter <C>memory:</C>
            </>,
            <>
              Ce dossier contient la mémoire de sous-agent scopée au projet,
              destinée à être partagée avec l'équipe. Pour la garder hors du
              contrôle de version, utilise <C>memory: local</C> (écrit dans{" "}
              <C>.claude/agent-memory-local/</C>). Pour une mémoire
              inter-projets, utilise <C>memory: user</C> (écrit dans{" "}
              <C>~/.claude/agent-memory/</C>)
            </>,
            <>
              L'auto-mémoire de session principale est une fonctionnalité
              différente ; voir <C>~/.claude/projects/</C> dans l'onglet Global
            </>,
          ],
          docsLink: "/en/sub-agents#enable-persistent-memory",
          children: [
            {
              id: "agent-memory-sub",
              label: "<agent-name>/",
              type: "folder",
              icon: "folder",
              color: "#C46686",
              autogen: true,
              children: [
                {
                  id: "agent-memory-md",
                  label: "MEMORY.md",
                  type: "file",
                  icon: "md",
                  color: "#C46686",
                  badge: "committed",
                  autogen: true,
                  oneLiner:
                    "Le sous-agent écrit et maintient ce fichier automatiquement",
                  when: "Chargé dans le system prompt du sous-agent à son démarrage",
                  description: (
                    <>
                      Fonctionne comme ton{" "}
                      <A href="/en/memory#auto-memory">auto-mémoire principale</A>{" "}
                      : le sous-agent crée et met à jour ce fichier lui-même. Tu
                      ne l'écris pas. Le sous-agent le lit au début de chaque
                      tâche et y réécrit ce qu'il apprend.
                    </>
                  ),
                  example: `# code-reviewer memory

## Patterns seen
- Project uses custom Result<T, E> type, not exceptions
- Auth middleware expects Bearer token in Authorization header
- Tests use factory functions in test/factories/

## Recurring issues
- Missing null checks on API responses (src/api/*)
- Unhandled promise rejections in background jobs`,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const GLOBAL_TREE: TreeNode = {
  id: "global-root",
  label: "~/",
  type: "folder",
  icon: "folder",
  color: "var(--ce-accent)",
  children: [
    {
      id: "claude-json",
      label: ".claude.json",
      type: "file",
      icon: "json",
      color: "var(--ce-text-3)",
      badge: "local",
      oneLiner: "État de l'app et préférences d'UI",
      when: (
        <>
          Lu au début de session pour tes préférences et tes serveurs MCP. Claude
          Code y réécrit quand tu changes des réglages dans <C>/config</C> ou
          approuves des prompts de confiance
        </>
      ),
      description: (
        <>
          Contient l'état qui n'a pas sa place dans settings.json : thème,
          session OAuth, décisions de confiance par projet, tes serveurs MCP
          personnels, et bascules d'UI. Se gère surtout via <C>/config</C> plutôt
          qu'en éditant directement.
        </>
      ),
      tips: [
        <>
          Les bascules IDE comme <C>autoConnectIde</C> et{" "}
          <C>externalEditorContext</C> vivent ici, pas dans settings.json
        </>,
        <>
          La clé <C>projects</C> suit l'état par projet comme l'acceptation du
          dialogue de confiance et les dernières métriques de session. Les règles
          de permission approuvées en session vont plutôt dans{" "}
          <C>.claude/settings.local.json</C>
        </>,
        <>
          Les serveurs MCP ici ne sont qu'à toi : le scope user s'applique à tous
          les projets, le scope local est par projet mais non commité. Les
          serveurs partagés avec l'équipe vont plutôt dans <C>.mcp.json</C> à la
          racine du projet
        </>,
      ],
      example: `{
  "autoConnectIde": true,
  "externalEditorContext": true,
  "mcpServers": {
    "my-tools": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"]
    }
  }
}`,
      docsLink: "/en/settings#global-config-settings",
    },
    {
      id: "global-dot-claude",
      label: ".claude/",
      type: "folder",
      icon: "folder",
      color: "var(--ce-accent)",
      oneLiner: "Ta configuration personnelle, pour tous les projets",
      description:
        "Le pendant global de ton dossier .claude/ de projet. Les fichiers d'ici s'appliquent à tous les projets sur lesquels tu travailles et ne sont jamais commités dans aucun dépôt.",
      children: [
        {
          id: "global-claude-md",
          label: "CLAUDE.md",
          type: "file",
          icon: "md",
          color: "#6A9BCC",
          badge: "local",
          oneLiner: "Préférences personnelles pour tous les projets",
          when: "Chargé au début de chaque session, dans chaque projet",
          description:
            "Ton fichier d'instructions global. Chargé aux côtés du CLAUDE.md de projet au début de session, donc les deux sont dans le contexte ensemble. En cas de conflit, les instructions au niveau projet priment. Garde-le pour les préférences qui s'appliquent partout : style de réponse, format de commit, conventions personnelles.",
          tips: [
            "Garde-le court puisqu'il se charge dans le contexte de chaque projet, aux côtés du CLAUDE.md du projet",
            "Idéal pour le style de réponse, le format de commit et les conventions personnelles",
          ],
          example: `# Global preferences

- Keep explanations concise
- Use conventional commit format
- Show the terminal command to verify changes
- Prefer composition over inheritance`,
          docsLink: "/en/memory",
        },
        {
          id: "global-settings",
          label: "settings.json",
          type: "file",
          icon: "json",
          color: "var(--ce-text-3)",
          badge: "local",
          oneLiner: "Réglages par défaut pour tous les projets",
          when: "Tes défauts. Les settings.json de projet et locaux surchargent toute clé que tu y définis aussi",
          description: [
            <>
              Mêmes clés que le <C>settings.json</C> de projet : permissions,
              hooks, model, variables d'environnement, et le reste. Mets ici les
              réglages que tu veux dans chaque projet, comme des permissions que
              tu autorises toujours, un modèle préféré, ou un hook de
              notification qui tourne quel que soit le projet.
            </>,
            <>
              Les réglages suivent un ordre de priorité : le <C>settings.json</C>{" "}
              de projet surcharge toute clé matchante définie ici. C'est
              différent de CLAUDE.md, où les fichiers global et projet sont tous
              deux chargés dans le contexte plutôt que fusionnés clé par clé.
            </>,
          ],
          example: `{
  "permissions": {
    "allow": [
      "Bash(git log *)",
      "Bash(git diff *)"
    ]
  }
}`,
          docsLink: "/en/settings",
        },
        {
          id: "keybindings",
          label: "keybindings.json",
          type: "file",
          icon: "json",
          color: "var(--ce-text-3)",
          badge: "local",
          oneLiner: "Raccourcis clavier personnalisés",
          when: "Lu au début de session et rechargé à chaud quand tu édites le fichier",
          description: (
            <>
              Réassigne les raccourcis clavier de la CLI interactive. Lance{" "}
              <C>/keybindings</C> pour créer ou ouvrir ce fichier avec une
              référence de schéma. Ctrl+C, Ctrl+D, Ctrl+M et Caps Lock sont
              réservés et ne peuvent pas être réassignés.
            </>
          ),
          exampleIntro: (
            <>
              Cet exemple lie <C>Ctrl+E</C> à l'ouverture de ton éditeur externe
              et délie <C>Ctrl+U</C> en le mettant à <C>null</C>. Le champ{" "}
              <C>context</C> scope les liaisons à une partie précise de la CLI,
              ici l'entrée de chat principale.
            </>
          ),
          example: `{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "$docs": "https://code.claude.com/docs/en/keybindings",
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "ctrl+e": "chat:externalEditor",
        "ctrl+u": null
      }
    }
  ]
}`,
          docsLink: "/en/keybindings",
        },
        {
          id: "themes",
          label: "themes/",
          type: "folder",
          icon: "folder",
          color: "#5AA7A7",
          oneLiner: "Thèmes de couleurs personnalisés",
          when: (
            <>
              Lu au début de session et rechargé à chaud quand les fichiers
              changent. Listé dans <C>/theme</C>
            </>
          ),
          description: (
            <>
              Chaque fichier <C>.json</C> définit un thème de couleurs
              personnalisé : un preset <C>base</C> intégré plus une map{" "}
              <C>overrides</C> de tokens de couleur. Crée-en un interactivement
              avec <C>/theme</C> ou écris le JSON à la main. Sélectionner un thème
              personnalisé stocke <C>custom:&lt;slug&gt;</C> comme préférence de
              thème.
            </>
          ),
          example: `{
  "name": "Dracula",
  "base": "dark",
  "overrides": {
    "claude": "#bd93f9",
    "error": "#ff5555",
    "success": "#50fa7b"
  }
}`,
          docsLink: "/en/terminal-config#create-a-custom-theme",
          children: [],
        },
        {
          id: "global-projects",
          label: "projects/",
          type: "folder",
          icon: "folder",
          color: "#E8A45C",
          autogen: true,
          oneLiner: "Auto-mémoire : les notes de Claude pour lui-même, par projet",
          when: "MEMORY.md chargé au début de session ; les fichiers thématiques lus à la demande",
          description:
            "L'auto-mémoire permet à Claude d'accumuler des connaissances entre les sessions sans que tu écrives quoi que ce soit. Claude enregistre des notes au fil du travail : commandes de build, insights de debug, notes d'architecture. Chaque projet a son propre dossier de mémoire, indexé par le chemin du dépôt.",
          tips: [
            <>
              Activé par défaut. Bascule avec <C>/memory</C> ou{" "}
              <C>autoMemoryEnabled</C> dans les settings
            </>,
            "MEMORY.md est l'index chargé à chaque session. Les 200 premières lignes, ou 25 Ko, selon la première limite atteinte, sont lues",
            "Les fichiers thématiques comme debugging.md sont lus à la demande, pas au démarrage",
            "Ce sont du markdown brut. Édite ou supprime-les à tout moment",
          ],
          docsLink: "/en/memory#auto-memory",
          children: [
            {
              id: "memory-dir",
              label: "<project>/memory/",
              type: "folder",
              icon: "folder",
              color: "#E8A45C",
              autogen: true,
              oneLiner: "Les connaissances accumulées par Claude pour un projet",
              children: [
                {
                  id: "memory-md",
                  label: "MEMORY.md",
                  type: "file",
                  icon: "md",
                  color: "#E8A45C",
                  badge: "local",
                  autogen: true,
                  oneLiner: "Claude écrit et maintient ce fichier automatiquement",
                  when: "Les 200 premières lignes (plafond 25 Ko) chargées au début de session",
                  description:
                    "Claude crée et met à jour ce fichier au fil du travail ; tu ne l'écris pas toi-même. Il fait office d'index que Claude lit au début de chaque session, pointant vers des fichiers thématiques pour le détail. Tu peux l'éditer ou le supprimer, mais Claude continuera de le mettre à jour.",
                  example: `# Memory Index

## Project
- [build-and-test.md](build-and-test.md): npm run build (~45s), Vitest, dev server on 3001
- [architecture.md](architecture.md): API client singleton, refresh-token auth

## Reference
- [debugging.md](debugging.md): auth token rotation and DB connection troubleshooting`,
                  docsLink: "/en/memory",
                },
                {
                  id: "memory-topic",
                  label: "debugging.md",
                  type: "file",
                  icon: "md",
                  color: "#E8A45C",
                  badge: "local",
                  autogen: true,
                  oneLiner: "Notes thématiques écrites quand MEMORY.md s'allonge",
                  when: "Claude le lit quand une tâche liée se présente",
                  description:
                    "Un exemple de fichier thématique que Claude crée quand MEMORY.md devient trop long. Claude choisit le nom de fichier selon ce qu'il en extrait : debugging.md, architecture.md, build-commands.md, ou similaire. Tu ne les crées jamais toi-même. Claude relit un fichier thématique seulement quand la tâche courante s'y rapporte.",
                  example: `---
name: Debugging patterns
description: Auth token rotation and database connection troubleshooting for this project
type: reference
---

## Auth Token Issues
- Refresh token rotation: old token invalidated immediately
- If 401 after refresh: check clock skew between client and server

## Database Connection Drops
- Connection pool: max 10 in dev, 50 in prod
- Always check \`docker compose ps\` first`,
                },
              ],
            },
          ],
        },
        {
          id: "global-rules",
          label: "rules/",
          type: "folder",
          icon: "folder",
          color: "#9B7BC4",
          oneLiner: "Rules au niveau utilisateur, appliquées à tous les projets",
          when: (
            <>
              Les rules sans <C>paths:</C> se chargent au début de session.
              Celles avec <C>paths:</C> se chargent quand un fichier matchant
              entre dans le contexte
            </>
          ),
          description:
            "Comme le .claude/rules/ de projet mais s'applique partout. À utiliser pour les conventions que tu veux sur tout ton travail, comme ton style de code personnel ou ton format de message de commit.",
          docsLink: "/en/memory#organize-rules-with-claude/rules/",
          children: [],
        },
        {
          id: "global-skills",
          label: "skills/",
          type: "folder",
          icon: "folder",
          color: "#D4A843",
          oneLiner: "Skills personnels disponibles dans tous les projets",
          when: (
            <>
              Invoqué avec <C>/skill-name</C> dans n'importe quel projet
            </>
          ),
          description:
            "Les skills que tu as créés pour toi et qui fonctionnent partout. Même structure que les skills de projet : chacun est un dossier avec SKILL.md, scopé à ton compte utilisateur plutôt qu'à un seul projet.",
          docsLink: "/en/skills",
          children: [],
        },
        {
          id: "global-commands",
          label: "commands/",
          type: "folder",
          icon: "folder",
          color: "#788C5D",
          oneLiner:
            "Commandes personnelles sur un fichier, disponibles dans tous les projets",
          note: commandsNote,
          when: (
            <>
              L'utilisateur tape <C>/command-name</C> dans n'importe quel projet
            </>
          ),
          description:
            "Comme le commands/ de projet mais scopé à ton compte utilisateur. Chaque fichier markdown devient une commande disponible partout.",
          docsLink: "/en/skills",
          children: [],
        },
        {
          id: "global-output-styles",
          label: "output-styles/",
          type: "folder",
          icon: "folder",
          color: "#5AA7A7",
          oneLiner:
            "Sections de system-prompt personnalisées qui ajustent le travail de Claude",
          when: "Appliqué au début de session quand sélectionné via le réglage outputStyle",
          description: [
            <>
              Chaque fichier markdown définit un output style : une section
              ajoutée au system prompt qui, par défaut, retire aussi les
              instructions intégrées de tâche d'ingénierie logicielle. À utiliser
              pour adapter Claude Code à des usages hors code, ou pour ajouter
              des modes pédagogie ou revue.
            </>,
            <>
              Sélectionne un style intégré ou personnalisé avec <C>/config</C> ou
              la clé <C>outputStyle</C> des settings. Les styles d'ici sont
              disponibles dans tous les projets ; les styles au niveau projet du
              même nom priment.
            </>,
          ],
          tips: [
            "Les styles intégrés Explanatory et Learning sont fournis avec Claude Code ; les styles personnalisés vont ici",
            <>
              Mets <C>keep-coding-instructions: true</C> dans le frontmatter pour
              conserver les instructions de tâche par défaut à côté de tes ajouts
            </>,
            "Les changements prennent effet à la session suivante, le system prompt étant figé au démarrage pour le cache",
          ],
          docsLink: "/en/output-styles",
          children: [
            {
              id: "output-style-example",
              label: "teaching.md",
              type: "file",
              icon: "md",
              color: "#5AA7A7",
              badge: "local",
              oneLiner:
                "Exemple de style qui ajoute des explications et te laisse les petits changements",
              when: (
                <>
                  Actif quand <C>outputStyle</C> dans les settings vaut{" "}
                  <C>teaching</C>
                </>
              ),
              description: (
                <>
                  Ce style ajoute des instructions au system prompt : Claude
                  ajoute une note «&nbsp;Why this approach&nbsp;» après chaque
                  tâche et laisse des marqueurs TODO(human) pour les changements
                  de moins de 10 lignes au lieu de les écrire lui-même.
                  Sélectionne-le en mettant <C>outputStyle</C> au nom de fichier
                  sans .md, ou au champ <C>name</C> si tu en définis un dans le
                  frontmatter.
                </>
              ),
              example: `---
description: Explains reasoning and asks you to implement small pieces
keep-coding-instructions: true
---

After completing each task, add a brief "Why this approach" note
explaining the key design decision.

When a change is under 10 lines, ask the user to implement it
themselves by leaving a TODO(human) marker instead of writing it.`,
            },
          ],
        },
        {
          id: "global-agents",
          label: "agents/",
          type: "folder",
          icon: "folder",
          color: "#C46686",
          oneLiner: "Sous-agents personnels disponibles dans tous les projets",
          when: "Claude délègue ou tu @-mentionnes dans n'importe quel projet",
          description:
            "Les sous-agents définis ici sont disponibles dans tous tes projets. Même format que les agents de projet.",
          docsLink: "/en/sub-agents",
          children: [],
        },
        {
          id: "global-workflows",
          label: "workflows/",
          type: "folder",
          icon: "folder",
          color: "#C46686",
          oneLiner: "Workflows dynamiques personnels disponibles dans tous les projets",
          when: "Chargé au démarrage ; chaque fichier devient une commande /<name>",
          description: (
            <>
              Les scripts de workflow enregistrés ici sont disponibles dans tous
              tes projets. Un workflow de projet du même nom dans{" "}
              <C>.claude/workflows/</C> prime.
            </>
          ),
          docsLink: "/en/workflows",
          children: [],
        },
        {
          id: "global-agent-memory",
          label: "agent-memory/",
          type: "folder",
          icon: "folder",
          color: "#C46686",
          autogen: true,
          oneLiner: (
            <>
              Mémoire persistante pour les sous-agents en <C>memory: user</C>
            </>
          ),
          when: "Chargé dans le system prompt du sous-agent à son démarrage",
          description: (
            <>
              Les sous-agents avec <C>memory: user</C> dans leur frontmatter
              stockent ici des connaissances qui persistent entre tous les
              projets. Pour une mémoire de sous-agent scopée au projet, voir{" "}
              <C>.claude/agent-memory/</C>.
            </>
          ),
          docsLink: "/en/sub-agents#enable-persistent-memory",
          children: [],
        },
      ],
    },
  ],
};
