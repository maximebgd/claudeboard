import { createElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, Session } from "./projects";

/**
 * Export **lecture seule** d'une session (ou d'un projet entier) en Markdown ou
 * HTML autonome, pour partage/archive. Aucune écriture dans ~/.claude : le rendu
 * est produit à la volée et servi en téléchargement par `/api/export`.
 */

export type ExportFormat = "md" | "html";

const ROLE_LABEL: Record<Session["events"][number]["role"], string> = {
  user: "Vous",
  assistant: "Claude",
};

function fmtDate(ts: string | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Slug de fichier sûr (sans accents ni caractères spéciaux). */
export function exportFilename(base: string, format: ExportFormat): string {
  const slug =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "export";
  return `claudeboard-${slug}.${format}`;
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function blockToMarkdown(block: Block): string {
  switch (block.kind) {
    case "text":
      return block.text.trim();
    case "thinking":
      return `<details>\n<summary>💭 Réflexion</summary>\n\n${block.text.trim()}\n\n</details>`;
    case "tool_use":
      return `<details>\n<summary>🔧 Outil : ${block.name}</summary>\n\n\`\`\`json\n${JSON.stringify(
        block.input,
        null,
        2
      )}\n\`\`\`\n\n</details>`;
    case "tool_result": {
      const label = block.isError ? "⚠️ Résultat outil (erreur)" : "📤 Résultat outil";
      return `<details>\n<summary>${label}</summary>\n\n\`\`\`\n${block.text.trim()}\n\`\`\`\n\n</details>`;
    }
  }
}

function sessionBodyMarkdown(session: Session): string {
  const parts: string[] = [];
  for (const ev of session.events) {
    const stamp = fmtDate(ev.timestamp);
    const icon = ev.role === "user" ? "🧑" : "🤖";
    parts.push(`### ${icon} ${ROLE_LABEL[ev.role]}${stamp ? ` · ${stamp}` : ""}`);
    const rendered = ev.blocks.map(blockToMarkdown).filter(Boolean);
    parts.push(rendered.join("\n\n"));
  }
  return parts.join("\n\n");
}

function sessionMetaLines(session: Session, projectPath: string): string[] {
  const lines = [
    `- **Projet** : ${projectPath}`,
    `- **Session** : \`${session.id}\``,
    `- **Messages** : ${session.events.length}`,
  ];
  if (session.gitBranch) lines.splice(2, 0, `- **Branche** : ${session.gitBranch}`);
  if (session.version) lines.push(`- **Version** : ${session.version}`);
  return lines;
}

export function sessionToMarkdown(session: Session, projectPath: string): string {
  const header = [
    `# ${session.title}`,
    "",
    `> Export claudeboard · ${fmtDate(new Date().toISOString())}`,
    "",
    ...sessionMetaLines(session, projectPath),
    "",
    "---",
    "",
  ].join("\n");
  return `${header}${sessionBodyMarkdown(session)}\n`;
}

export function projectToMarkdown(
  projectPath: string,
  projectLabel: string,
  sessions: Session[]
): string {
  const totalMessages = sessions.reduce((n, s) => n + s.events.length, 0);
  const header = [
    `# ${projectLabel}`,
    "",
    `> Export claudeboard · ${fmtDate(new Date().toISOString())}`,
    "",
    `- **Projet** : ${projectPath}`,
    `- **Sessions** : ${sessions.length}`,
    `- **Messages** : ${totalMessages}`,
    "",
  ].join("\n");

  const toc = [
    "## Sommaire",
    "",
    ...sessions.map((s, i) => `${i + 1}. [${s.title}](#session-${i + 1})`),
    "",
  ].join("\n");

  const body = sessions
    .map((s, i) => {
      const stamp = `<a id="session-${i + 1}"></a>`;
      const meta = sessionMetaLines(s, projectPath).join("\n");
      return `${stamp}\n\n## ${i + 1}. ${s.title}\n\n${meta}\n\n${sessionBodyMarkdown(s)}`;
    })
    .join("\n\n---\n\n");

  return `${header}\n${toc}\n---\n\n${body}\n`;
}

// ---------------------------------------------------------------------------
// HTML (document autonome, CSS embarqué)
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Rend un texte markdown en HTML sémantique via react-markdown (côté serveur).
 * `react-dom/server` est importé dynamiquement : Next interdit son import statique
 * dans le graphe de modules d'une route.
 */
async function mdToHtml(text: string): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, text)
  );
}

async function blockToHtml(block: Block): Promise<string> {
  switch (block.kind) {
    case "text":
      return `<div class="md">${await mdToHtml(block.text)}</div>`;
    case "thinking":
      return `<details class="thinking"><summary>💭 Réflexion</summary><pre>${esc(
        block.text
      )}</pre></details>`;
    case "tool_use":
      return `<details class="tool"><summary>🔧 Outil : ${esc(
        block.name
      )}</summary><pre>${esc(JSON.stringify(block.input, null, 2))}</pre></details>`;
    case "tool_result": {
      const label = block.isError ? "⚠️ Résultat outil (erreur)" : "📤 Résultat outil";
      return `<details class="tool${block.isError ? " error" : ""}"><summary>${label}</summary><pre>${esc(
        block.text
      )}</pre></details>`;
    }
  }
}

async function sessionEventsHtml(session: Session): Promise<string> {
  const events = await Promise.all(
    session.events.map(async (ev) => {
      const stamp = fmtDate(ev.timestamp);
      const cls = ev.role === "user" ? "user" : "assistant";
      const icon = ev.role === "user" ? "🧑" : "🤖";
      const blocks = (await Promise.all(ev.blocks.map(blockToHtml))).join("\n");
      return `<article class="msg ${cls}">
  <header><span class="who">${icon} ${ROLE_LABEL[ev.role]}</span>${
        stamp ? `<span class="ts">${stamp}</span>` : ""
      }</header>
  <div class="content">${blocks}</div>
</article>`;
    })
  );
  return events.join("\n");
}

const HTML_STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2.5rem 1rem 5rem;
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f6f7f9; color: #1a1c20;
  }
  .wrap { max-width: 820px; margin: 0 auto; }
  h1 { font-size: 1.7rem; margin: 0 0 .25rem; }
  .meta { color: #6b7280; font-size: .8rem; margin-bottom: 2rem; }
  .meta ul { list-style: none; padding: 0; margin: .5rem 0 0; display: flex; flex-wrap: wrap; gap: .35rem 1.25rem; }
  .meta code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .toc { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.5rem; margin-bottom: 2rem; }
  .toc h2 { font-size: .95rem; margin: 0 0 .5rem; }
  .toc ol { margin: 0; padding-left: 1.25rem; }
  .toc a { color: #2563eb; text-decoration: none; }
  .session-block { margin: 3rem 0; }
  .session-block > h2 { font-size: 1.3rem; border-bottom: 1px solid #e5e7eb; padding-bottom: .4rem; }
  .msg { display: flex; flex-direction: column; gap: .5rem; padding: 1rem 0; border-top: 1px solid #eceef1; }
  .msg header { display: flex; align-items: center; gap: .75rem; font-size: .8rem; color: #6b7280; }
  .msg .who { font-weight: 600; color: #111827; }
  .msg.assistant .who { color: #7c3aed; }
  .content { display: flex; flex-direction: column; gap: .6rem; }
  .md :first-child { margin-top: 0; }
  .md :last-child { margin-bottom: 0; }
  .md pre { background: #0d1117; color: #e6edf3; padding: .85rem 1rem; border-radius: 8px; overflow-x: auto; }
  .md code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .875em; }
  .md :not(pre) > code { background: #eceef1; padding: .1em .35em; border-radius: 4px; }
  .md table { border-collapse: collapse; }
  .md th, .md td { border: 1px solid #e5e7eb; padding: .35rem .6rem; }
  details { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: .5rem .85rem; }
  details.thinking { border-color: #d8b4fe; }
  details.tool.error { border-color: #fca5a5; }
  summary { cursor: pointer; font-size: .82rem; color: #6b7280; user-select: none; }
  details pre { margin: .6rem 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; white-space: pre-wrap; word-break: break-word; max-height: 480px; overflow: auto; }
  @media (prefers-color-scheme: dark) {
    body { background: #0d0f12; color: #e6e8eb; }
    .toc, details, .msg .who { background: #16181d; }
    .msg .who { background: none; color: #f3f4f6; }
    .toc { border-color: #2a2d34; }
    .session-block > h2, .msg { border-color: #23262c; }
    details { border-color: #2a2d34; }
    .md :not(pre) > code { background: #23262c; }
    .md th, .md td { border-color: #2a2d34; }
  }
`;

function htmlDocument(title: string, bodyInner: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="claudeboard">
<title>${esc(title)}</title>
<style>${HTML_STYLE}</style>
</head>
<body>
<div class="wrap">
${bodyInner}
</div>
</body>
</html>`;
}

function metaBlockHtml(lines: [string, string][]): string {
  const items = lines
    .map(([k, v]) => `<li><strong>${esc(k)}</strong> ${v}</li>`)
    .join("");
  return `<div class="meta"><div>Export claudeboard · ${fmtDate(
    new Date().toISOString()
  )}</div><ul>${items}</ul></div>`;
}

export async function sessionToHtml(session: Session, projectPath: string): Promise<string> {
  const meta: [string, string][] = [["Projet :", esc(projectPath)]];
  if (session.gitBranch) meta.push(["Branche :", esc(session.gitBranch)]);
  if (session.version) meta.push(["Version :", esc(session.version)]);
  meta.push(["Session :", `<code>${esc(session.id)}</code>`]);
  meta.push(["Messages :", String(session.events.length)]);

  const inner = `<h1>${esc(session.title)}</h1>
${metaBlockHtml(meta)}
${await sessionEventsHtml(session)}`;
  return htmlDocument(session.title, inner);
}

export async function projectToHtml(
  projectPath: string,
  projectLabel: string,
  sessions: Session[]
): Promise<string> {
  const totalMessages = sessions.reduce((n, s) => n + s.events.length, 0);
  const meta: [string, string][] = [
    ["Projet :", esc(projectPath)],
    ["Sessions :", String(sessions.length)],
    ["Messages :", String(totalMessages)],
  ];
  const toc = `<nav class="toc"><h2>Sommaire</h2><ol>${sessions
    .map((s, i) => `<li><a href="#session-${i + 1}">${esc(s.title)}</a></li>`)
    .join("")}</ol></nav>`;

  const body = (
    await Promise.all(
      sessions.map(async (s, i) => {
        const sMeta: [string, string][] = [["Session :", `<code>${esc(s.id)}</code>`]];
        if (s.gitBranch) sMeta.push(["Branche :", esc(s.gitBranch)]);
        sMeta.push(["Messages :", String(s.events.length)]);
        return `<section class="session-block" id="session-${i + 1}">
<h2>${i + 1}. ${esc(s.title)}</h2>
${metaBlockHtml(sMeta)}
${await sessionEventsHtml(s)}
</section>`;
      })
    )
  ).join("\n");

  const inner = `<h1>${esc(projectLabel)}</h1>
${metaBlockHtml(meta)}
${toc}
${body}`;
  return htmlDocument(projectLabel, inner);
}
