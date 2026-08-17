import type { ReactNode } from "react";
import { A, C, type TreeNode } from "./directoryTreeShared";

/*
 * **English** content of the `.claude` structure explorer. Pure JSX data set: two
 * trees (`PROJECT_TREE`, `GLOBAL_TREE`) of `TreeNode`. The French variant lives in
 * `directoryTree.fr.tsx` (the source of truth); `DirectoryExplorer` picks one based
 * on the language. See `directoryTreeShared` for the type and the `A`/`C` helpers.
 */

export const commandsNote: ReactNode = (
  <>
    Commands and skills now rely on the same mechanism. For any new workflow,
    prefer a <A href="/en/skills">skill</A>: same <C>/name</C> invocation, and you
    can additionally bundle support files.
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
      oneLiner: "Project instructions read at the start of every session",
      when: "Loaded into context at the start of every session",
      description:
        "Project-specific instructions that frame how Claude works in this repository. Put your conventions, common commands and architecture context here so Claude starts from the same assumptions as your team.",
      tips: [
        "Aim for under 200 lines. Longer files still load in full but can reduce adherence",
        <>
          CLAUDE.md loads on every session. If something only concerns certain
          tasks, move it into a <A href="/en/skills">skill</A> or a{" "}
          <A href="/en/memory#organize-rules-with-claude/rules/">rule</A>{" "}
          scoped by path, so it only loads when needed
        </>,
        "List the commands you run most (build, test, format) so Claude knows them without you repeating them",
        <>
          Run <C>/memory</C> to open and edit CLAUDE.md from a session
        </>,
        <>
          Also works at <C>.claude/CLAUDE.md</C> if you prefer to keep the project
          root clean
        </>,
      ],
      exampleIntro:
        "This example targets a TypeScript + React project. It lists the build and test commands, the framework conventions Claude should follow, and project-specific rules like the export style and file organization.",
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
      oneLiner: "Project MCP servers, shared with the team",
      when: (
        <>
          Servers connect at session startup. Tool schemas are deferred by default
          and loaded on demand via{" "}
          <A href="/en/mcp#scale-with-mcp-tool-search">tool search</A>
        </>
      ),
      description: (
        <>
          Configures the Model Context Protocol (MCP) servers that give Claude
          access to external tools: databases, APIs, browsers, and so on. This file
          holds the project-scoped servers the whole team uses. Personal servers you
          want to keep to yourself go in <C>~/.claude.json</C> instead.
        </>
      ),
      tips: [
        <>
          Use environment variable references for secrets:{" "}
          <C>{"${NOTION_TOKEN}"}</C>
        </>,
        <>
          Lives at the project root, not in <C>.claude/</C>
        </>,
        <>
          For a server that only concerns you, run{" "}
          <C>claude mcp add --scope user</C>. That writes to <C>~/.claude.json</C>{" "}
          rather than <C>.mcp.json</C>
        </>,
      ],
      exampleIntro: (
        <>
          This example configures the Notion MCP server so Claude can read and
          update pages in your workspace. The <C>{"${NOTION_TOKEN}"}</C> reference
          is read from the shell environment when Claude Code starts, so the token
          never ends up in the file.
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
      oneLiner: "Gitignored files to copy into new worktrees",
      when: (
        <>
          Read when Claude creates a git worktree via <C>--worktree</C>, the{" "}
          <C>EnterWorktree</C> tool, or a sub-agent in{" "}
          <C>isolation: worktree</C>
        </>
      ),
      description: (
        <>
          Lists the gitignored files to copy from your main repository into each
          new worktree. Worktrees are clean checkouts, so untracked files like{" "}
          <C>.env</C> are missing by default. Patterns follow <C>.gitignore</C>{" "}
          syntax. Only files that match a pattern <em>and</em> are also gitignored
          get copied, so tracked files are never duplicated.
        </>
      ),
      tips: [
        <>
          Lives at the project root, not in <C>.claude/</C>
        </>,
        <>
          Git only: if you set up a{" "}
          <A href="/en/hooks#worktreecreate">WorktreeCreate hook</A> for another
          VCS, this file is not read. Copy the files in your hook script instead
        </>,
        <>
          Also applies to the parallel sessions of the{" "}
          <A href="/en/desktop#work-in-parallel-with-sessions">desktop app</A>
        </>,
      ],
      exampleIntro:
        "This example copies your local environment files and a secrets config into every worktree Claude creates. Comments start with # and blank lines are ignored, just like in .gitignore.",
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
      oneLiner: "Project-level configuration, rules and extensions",
      description:
        "Everything Claude Code reads that is specific to this project. If you use git, commit most of the files here to share them with your team; a few, like settings.local.json, are gitignored when Claude Code writes settings into them. Each file's badge shows which.",
      children: [
        {
          id: "settings-json",
          label: "settings.json",
          type: "file",
          icon: "json",
          color: "var(--ce-text-3)",
          badge: "committed",
          oneLiner: "Permissions, hooks and configuration",
          when: (
            <>
              Overrides the global <C>~/.claude/settings.json</C>. Local settings,
              CLI flags and managed settings override this one
            </>
          ),
          description:
            "Settings that Claude Code applies directly. Permissions control which commands and tools Claude can use; hooks run your scripts at specific moments of a session. Unlike CLAUDE.md, which Claude reads as guidance, these are enforced whether or not Claude follows them.",
          contains: [
            <>
              <A href="/en/permissions">permissions</A>: allow, deny, or ask before
              Claude uses certain tools or commands
            </>,
            <>
              <A href="/en/hooks">hooks</A>: run your own scripts on events (before
              a tool call, after a file edit…)
            </>,
            <>
              <A href="/en/statusline">statusLine</A>: customize the line shown at
              the bottom while Claude works
            </>,
            <>
              <A href="/en/settings#available-settings">model</A>: choose a default
              model for this project
            </>,
            <>
              <A href="/en/settings#environment-variables">env</A>: environment
              variables set in every session
            </>,
            <>
              <A href="/en/output-styles">outputStyle</A>: select a custom
              system-prompt style from output-styles/
            </>,
          ],
          tips: [
            <>
              Bash permission patterns accept wildcards: <C>Bash(npm test *)</C>{" "}
              matches any command starting with <C>npm test</C>
            </>,
            <>
              Array settings like <C>permissions.allow</C> combine across all
              scopes; scalar settings like <C>model</C> take the most specific value
            </>,
          ],
          exampleIntro: (
            <>
              This example allows <C>npm test</C> and <C>npm run</C> without asking,
              blocks <C>rm -rf</C>, and runs Prettier on files after Claude has
              edited or created them.
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
          oneLiner: "Your personal settings for this project",
          when: "The highest-priority of the user-editable settings files; CLI flags and managed settings still take precedence",
          description:
            "Personal settings that take precedence over the project defaults. Same JSON format as settings.json, gitignored when Claude Code saves a setting into it. Use it when you need different permissions or defaults from the team config.",
          tips: [
            <>
              Same schema as settings.json. Array settings like{" "}
              <C>permissions.allow</C> combine across scopes; scalar settings like{" "}
              <C>model</C> take the local value
            </>,
            <>
              When Claude Code saves a setting into this file in a repo that does
              not already ignore it, it adds{" "}
              <C>**/.claude/settings.local.json</C> to your global git excludes
              file. To share the ignore rule with your team, add it to the
              project's <C>.gitignore</C> too
            </>,
          ],
          exampleIntro:
            "This example adds Docker permissions on top of what the team settings.json already allows.",
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
          oneLiner: "Topic-based instructions, optionally filtered by path",
          when: (
            <>
              Rules without <C>paths:</C> load at the start of the session. Those
              with <C>paths:</C> load when a matching file enters the context
            </>
          ),
          description: [
            <>
              Project instructions split into topic files that can load
              conditionally based on file paths. A rule without a <C>paths:</C>{" "}
              frontmatter loads at the start of the session like CLAUDE.md; a rule
              with <C>paths:</C> only loads when Claude reads a matching file.
            </>,
            <>
              Like CLAUDE.md, rules are guidance Claude reads, not configuration
              enforced by Claude Code. For guaranteed behavior, use{" "}
              <A href="/en/hooks">hooks</A> or <A href="/en/permissions">permissions</A>.
            </>,
          ],
          tips: [
            <>
              Use the <C>paths:</C> frontmatter with globs to scope a rule to
              specific directories or file types
            </>,
            <>
              Subfolders work: <C>.claude/rules/frontend/react.md</C> is discovered
              automatically
            </>,
            "When CLAUDE.md approaches 200 lines, start splitting it into rules",
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
              oneLiner: "Testing conventions scoped to test files",
              when: (
                <>
                  Loaded when Claude reads a file matching the <C>paths:</C> globs
                  below
                </>
              ),
              description: (
                <>
                  An example rule that only loads when Claude works on test files.
                  The <C>paths:</C> globs in the frontmatter define which files
                  trigger it; here, anything ending in .test.ts or .test.tsx. For
                  other files, this rule is not loaded into the context.
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
              oneLiner: "API conventions scoped to backend code",
              when: (
                <>
                  Loaded when Claude reads a file matching the <C>paths:</C> glob
                  below
                </>
              ),
              description: (
                <>
                  A second example showing a rule scoped to backend code. The{" "}
                  <C>paths:</C> glob matches files under src/api/, so these
                  conventions only load when Claude edits API routes.
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
          oneLiner: "Reusable prompts invoked by name, by you or Claude",
          when: (
            <>
              Invoked with <C>/skill-name</C> or when Claude matches the task to a
              skill
            </>
          ),
          description: (
            <>
              Each skill is a folder with a SKILL.md file plus the support files it
              needs. By default, both you and Claude can invoke a skill. The
              frontmatter lets you control this:{" "}
              <C>disable-model-invocation: true</C> for a user-only workflow like{" "}
              <C>/deploy</C>, or <C>user-invocable: false</C> to hide it from the{" "}
              <C>/</C> menu while still letting Claude invoke it.
            </>
          ),
          tips: [
            <>
              Skills accept arguments: <C>/deploy staging</C> passes
              &ldquo;staging&rdquo; as <C>$ARGUMENTS</C>. Use <C>$0</C>, <C>$1</C>,
              etc. for positional access
            </>,
            <>
              The <C>description</C> frontmatter determines when Claude
              auto-invokes the skill
            </>,
            "Bundle reference docs next to SKILL.md. Claude knows the skill folder path and can read support files when you mention them",
          ],
          docsLink: "/en/skills",
          children: [
            {
              id: "skill-review",
              label: "security-review/",
              type: "folder",
              icon: "folder",
              color: "#D4A843",
              oneLiner: "A skill bundling SKILL.md and its support files",
              children: [
                {
                  id: "skill-review-md",
                  label: "SKILL.md",
                  type: "file",
                  icon: "md",
                  color: "#D4A843",
                  badge: "committed",
                  oneLiner: "Entry point: trigger, invocability, instructions",
                  when: (
                    <>
                      The user types{" "}
                      <C>/security-review &lt;target&gt;</C>; Claude cannot
                      auto-invoke this skill
                    </>
                  ),
                  description: [
                    <>
                      This skill uses <C>disable-model-invocation: true</C> so that
                      only you can trigger it; Claude never invokes it on its own.
                    </>,
                    <>
                      The <C>!`...`</C> line runs a shell command and injects its
                      output into the prompt. <C>$ARGUMENTS</C> substitutes whatever
                      you typed after the skill name. Claude sees the skill folder
                      path, so mentioning a bundled file like checklist.md lets it
                      read it.
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
                  oneLiner: "Support file bundled with the skill",
                  when: "Claude reads it on demand while running the skill",
                  description: (
                    <>
                      Skills can bundle any support file: reference docs, templates,
                      scripts. The skill folder path is prepended to SKILL.md, so
                      Claude can read bundled files by name. For scripts in bash
                      injection commands, use the{" "}
                      <C>{"${CLAUDE_SKILL_DIR}"}</C> placeholder.
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
              Single-file prompts invoked with <C>/name</C>
            </>
          ),
          note: commandsNote,
          when: (
            <>
              The user types <C>/command-name</C>
            </>
          ),
          description: (
            <>
              A <C>commands/deploy.md</C> file creates <C>/deploy</C> the same way
              a <C>skills/deploy/SKILL.md</C> skill does, and both can be
              auto-invoked by Claude. Skills use a folder with SKILL.md, which lets
              you bundle reference docs, templates or scripts next to the prompt.
            </>
          ),
          tips: [
            <>
              Use <C>$ARGUMENTS</C> in the file to accept parameters:{" "}
              <C>/fix-issue 123</C>
            </>,
            "If a skill and a command share a name, the skill takes precedence",
            "New commands should really be skills; commands remain supported",
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
                  Invoked with <C>/fix-issue &lt;number&gt;</C>
                </>
              ),
              note: commandsNote,
              description: [
                <>
                  An example command to fix a GitHub issue. Type{" "}
                  <C>/fix-issue 123</C> and the <C>!`...`</C> line runs{" "}
                  <C>gh issue view 123</C> in your shell, injecting the output into
                  the prompt before Claude sees it.
                </>,
                <>
                  <C>$ARGUMENTS</C> substitutes whatever you typed after the command
                  name. For positional access, use <C>$0</C> <C>$1</C>, etc.
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
          oneLiner: "Project output styles, if the team shares any",
          when: "Applied at the start of the session when selected via the outputStyle setting",
          description: (
            <>
              Output styles are usually personal, so most live in{" "}
              <C>~/.claude/output-styles/</C>. Put one here if your team shares a
              style, for example a review mode everyone uses. See the Global tab
              for the full explanation and an example.
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
          oneLiner: "Specialized sub-agents with their own context window",
          when: "Runs in its own context window when you or Claude invokes it",
          description:
            "Each markdown file defines a sub-agent with its own system prompt, tool access and optionally its own model. Sub-agents run in a clean context window, which keeps the main conversation tidy. Useful for parallel work or isolated tasks.",
          tips: [
            "Each agent has a clean context window, separate from your main session",
            <>
              Restrict tool access per agent with the <C>tools:</C> frontmatter
              field
            </>,
            "Type @ and pick an agent from the autocomplete to delegate directly",
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
              oneLiner: "Sub-agent for an isolated code review",
              when: "Claude launches it for review tasks, or you @-mention it from the autocomplete",
              description: (
                <>
                  An example sub-agent restricted to read-only tools. The{" "}
                  <C>description</C> frontmatter tells Claude when to delegate to it
                  automatically; <C>tools:</C> limits it to Read, Grep and Glob so
                  it can inspect code without ever editing it. The body becomes the
                  sub-agent's system prompt.
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
          oneLiner: "Dynamic workflow scripts that orchestrate sub-agents",
          when: "Loaded at startup; each file becomes a /<name> command",
          description: (
            <>
              Each <C>.js</C> file is a{" "}
              <A href="/en/workflows">dynamic workflow</A>: a script the runtime
              executes to launch and coordinate several sub-agents. Workflows are
              written by Claude and saved here from <C>/workflows</C> rather than
              written by hand.
            </>
          ),
          tips: [
            <>
              Save a run from <C>/workflows</C> with <C>s</C> to create one
            </>,
            <>
              A project workflow takes precedence over a personal workflow of the
              same name in <C>~/.claude/workflows/</C>
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
            "Persistent sub-agent memory, distinct from session auto-memory",
          when: "The first 200 lines (25 KB cap) of MEMORY.md loaded into the sub-agent's system prompt when it runs",
          description: (
            <>
              Sub-agents with <C>memory: project</C> in their frontmatter get a
              dedicated memory folder here. This is distinct from your{" "}
              <A href="/en/memory#auto-memory">main session auto-memory</A>{" "}
              in <C>~/.claude/projects/</C>: each sub-agent reads and writes its
              own MEMORY.md, not yours.
            </>
          ),
          tips: [
            <>
              Only created for sub-agents that set the <C>memory:</C> frontmatter
              field
            </>,
            <>
              This folder holds project-scoped sub-agent memory, meant to be shared
              with the team. To keep it out of version control, use{" "}
              <C>memory: local</C> (writes to{" "}
              <C>.claude/agent-memory-local/</C>). For cross-project memory, use{" "}
              <C>memory: user</C> (writes to <C>~/.claude/agent-memory/</C>)
            </>,
            <>
              Main session auto-memory is a different feature; see{" "}
              <C>~/.claude/projects/</C> in the Global tab
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
                    "The sub-agent writes and maintains this file automatically",
                  when: "Loaded into the sub-agent's system prompt at startup",
                  description: (
                    <>
                      Works like your{" "}
                      <A href="/en/memory#auto-memory">main auto-memory</A>{" "}
                      : the sub-agent creates and updates this file itself. You do
                      not write it. The sub-agent reads it at the start of each task
                      and rewrites what it learns into it.
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
      oneLiner: "App state and UI preferences",
      when: (
        <>
          Read at the start of the session for your preferences and MCP servers.
          Claude Code writes back to it when you change settings in <C>/config</C>{" "}
          or approve trust prompts
        </>
      ),
      description: (
        <>
          Holds the state that does not belong in settings.json: theme, OAuth
          session, per-project trust decisions, your personal MCP servers, and UI
          toggles. Mostly managed via <C>/config</C> rather than by editing it
          directly.
        </>
      ),
      tips: [
        <>
          IDE toggles like <C>autoConnectIde</C> and{" "}
          <C>externalEditorContext</C> live here, not in settings.json
        </>,
        <>
          The <C>projects</C> key tracks per-project state like acceptance of the
          trust dialog and the latest session metrics. Permission rules approved
          during a session go into{" "}
          <C>.claude/settings.local.json</C> instead
        </>,
        <>
          The MCP servers here are yours alone: the user scope applies to all
          projects, the local scope is per project but uncommitted. Servers shared
          with the team go in <C>.mcp.json</C> at the project root instead
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
      oneLiner: "Your personal configuration, for all projects",
      description:
        "The global counterpart of your project .claude/ folder. The files here apply to every project you work on and are never committed to any repository.",
      children: [
        {
          id: "global-claude-md",
          label: "CLAUDE.md",
          type: "file",
          icon: "md",
          color: "#6A9BCC",
          badge: "local",
          oneLiner: "Personal preferences for all projects",
          when: "Loaded at the start of every session, in every project",
          description:
            "Your global instructions file. Loaded alongside the project CLAUDE.md at the start of the session, so both are in context together. When they conflict, the project-level instructions win. Keep it for preferences that apply everywhere: response style, commit format, personal conventions.",
          tips: [
            "Keep it short since it loads into the context of every project, alongside the project's CLAUDE.md",
            "Ideal for response style, commit format and personal conventions",
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
          oneLiner: "Default settings for all projects",
          when: "Your defaults. Project and local settings.json override any key you also set here",
          description: [
            <>
              Same keys as the project <C>settings.json</C>: permissions, hooks,
              model, environment variables, and the rest. Put the settings you want
              in every project here, like permissions you always allow, a preferred
              model, or a notification hook that runs regardless of the project.
            </>,
            <>
              Settings follow a priority order: the project <C>settings.json</C>{" "}
              overrides any matching key set here. This is different from CLAUDE.md,
              where the global and project files are both loaded into the context
              rather than merged key by key.
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
          oneLiner: "Custom keyboard shortcuts",
          when: "Read at the start of the session and hot-reloaded when you edit the file",
          description: (
            <>
              Reassign the interactive CLI's keyboard shortcuts. Run{" "}
              <C>/keybindings</C> to create or open this file with a schema
              reference. Ctrl+C, Ctrl+D, Ctrl+M and Caps Lock are reserved and
              cannot be reassigned.
            </>
          ),
          exampleIntro: (
            <>
              This example binds <C>Ctrl+E</C> to opening your external editor and
              unbinds <C>Ctrl+U</C> by setting it to <C>null</C>. The{" "}
              <C>context</C> field scopes the bindings to a specific part of the
              CLI, here the main chat input.
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
          oneLiner: "Custom color themes",
          when: (
            <>
              Read at the start of the session and hot-reloaded when the files
              change. Listed in <C>/theme</C>
            </>
          ),
          description: (
            <>
              Each <C>.json</C> file defines a custom color theme: a built-in{" "}
              <C>base</C> preset plus an <C>overrides</C> map of color tokens.
              Create one interactively with <C>/theme</C> or write the JSON by
              hand. Selecting a custom theme stores <C>custom:&lt;slug&gt;</C> as
              the theme preference.
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
          oneLiner: "Auto-memory: Claude's notes to itself, per project",
          when: "MEMORY.md loaded at the start of the session; topic files read on demand",
          description:
            "Auto-memory lets Claude accumulate knowledge across sessions without you writing anything. Claude saves notes as it works: build commands, debugging insights, architecture notes. Each project has its own memory folder, indexed by the repository path.",
          tips: [
            <>
              Enabled by default. Toggle with <C>/memory</C> or{" "}
              <C>autoMemoryEnabled</C> in the settings
            </>,
            "MEMORY.md is the index loaded every session. The first 200 lines, or 25 KB, whichever comes first, are read",
            "Topic files like debugging.md are read on demand, not at startup",
            "They are plain markdown. Edit or delete them at any time",
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
              oneLiner: "The knowledge Claude has accumulated for a project",
              children: [
                {
                  id: "memory-md",
                  label: "MEMORY.md",
                  type: "file",
                  icon: "md",
                  color: "#E8A45C",
                  badge: "local",
                  autogen: true,
                  oneLiner: "Claude writes and maintains this file automatically",
                  when: "The first 200 lines (25 KB cap) loaded at the start of the session",
                  description:
                    "Claude creates and updates this file as it works; you do not write it yourself. It acts as an index that Claude reads at the start of every session, pointing to topic files for detail. You can edit or delete it, but Claude will keep updating it.",
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
                  oneLiner: "Topic notes written when MEMORY.md grows long",
                  when: "Claude reads it when a related task comes up",
                  description:
                    "An example topic file that Claude creates when MEMORY.md gets too long. Claude chooses the filename based on what it extracts: debugging.md, architecture.md, build-commands.md, or similar. You never create them yourself. Claude re-reads a topic file only when the current task relates to it.",
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
          oneLiner: "User-level rules, applied to all projects",
          when: (
            <>
              Rules without <C>paths:</C> load at the start of the session. Those
              with <C>paths:</C> load when a matching file enters the context
            </>
          ),
          description:
            "Like the project .claude/rules/ but applies everywhere. Use it for conventions you want across all your work, like your personal code style or your commit message format.",
          docsLink: "/en/memory#organize-rules-with-claude/rules/",
          children: [],
        },
        {
          id: "global-skills",
          label: "skills/",
          type: "folder",
          icon: "folder",
          color: "#D4A843",
          oneLiner: "Personal skills available in all projects",
          when: (
            <>
              Invoked with <C>/skill-name</C> in any project
            </>
          ),
          description:
            "The skills you created for yourself that work everywhere. Same structure as project skills: each is a folder with SKILL.md, scoped to your user account rather than to a single project.",
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
            "Personal single-file commands, available in all projects",
          note: commandsNote,
          when: (
            <>
              The user types <C>/command-name</C> in any project
            </>
          ),
          description:
            "Like the project commands/ but scoped to your user account. Each markdown file becomes a command available everywhere.",
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
            "Custom system-prompt sections that adjust how Claude works",
          when: "Applied at the start of the session when selected via the outputStyle setting",
          description: [
            <>
              Each markdown file defines an output style: a section added to the
              system prompt that, by default, also removes the built-in
              software-engineering task instructions. Use it to adapt Claude Code
              to non-coding uses, or to add teaching or review modes.
            </>,
            <>
              Select a built-in or custom style with <C>/config</C> or the{" "}
              <C>outputStyle</C> settings key. The styles here are available in all
              projects; project-level styles of the same name take precedence.
            </>,
          ],
          tips: [
            "The built-in Explanatory and Learning styles ship with Claude Code; custom styles go here",
            <>
              Set <C>keep-coding-instructions: true</C> in the frontmatter to keep
              the default task instructions alongside your additions
            </>,
            "Changes take effect on the next session, since the system prompt is frozen at startup for caching",
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
                "Example style that adds explanations and leaves small changes to you",
              when: (
                <>
                  Active when <C>outputStyle</C> in the settings equals{" "}
                  <C>teaching</C>
                </>
              ),
              description: (
                <>
                  This style adds instructions to the system prompt: Claude adds a
                  &ldquo;Why this approach&rdquo; note after each task and leaves
                  TODO(human) markers for changes under 10 lines instead of writing
                  them itself. Select it by setting <C>outputStyle</C> to the
                  filename without .md, or to the <C>name</C> field if you define
                  one in the frontmatter.
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
          oneLiner: "Personal sub-agents available in all projects",
          when: "Claude delegates or you @-mention in any project",
          description:
            "The sub-agents defined here are available across all your projects. Same format as project agents.",
          docsLink: "/en/sub-agents",
          children: [],
        },
        {
          id: "global-workflows",
          label: "workflows/",
          type: "folder",
          icon: "folder",
          color: "#C46686",
          oneLiner: "Personal dynamic workflows available in all projects",
          when: "Loaded at startup; each file becomes a /<name> command",
          description: (
            <>
              The workflow scripts saved here are available across all your
              projects. A project workflow of the same name in{" "}
              <C>.claude/workflows/</C> takes precedence.
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
              Persistent memory for sub-agents in <C>memory: user</C>
            </>
          ),
          when: "Loaded into the sub-agent's system prompt at startup",
          description: (
            <>
              Sub-agents with <C>memory: user</C> in their frontmatter store
              knowledge here that persists across all projects. For project-scoped
              sub-agent memory, see <C>.claude/agent-memory/</C>.
            </>
          ),
          docsLink: "/en/sub-agents#enable-persistent-memory",
          children: [],
        },
      ],
    },
  ],
};
