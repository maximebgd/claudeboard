import { createElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, Session, SessionMeta } from "./projects";
import type { ProjectStats } from "./analytics";
import { formatSize } from "./claude";

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

const compactNum = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const fullNum = new Intl.NumberFormat("fr-FR");

/** Nombre compact au-delà de 10 000 (comme sur les pages du dashboard). */
function fmtNum(n: number): string {
  return n >= 10000 ? compactNum.format(n) : fullNum.format(n);
}

function fmtUSD(n: number): string {
  if (n > 0 && n < 0.01) return "< 0,01 $";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

/** Durée active « 2j 05h 30min » / « 3 h 05 » / « 12 min » (comme la page projet). */
function fmtDuration(ms: number): string {
  if (ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}j ${(h % 24).toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}min`;
  }
  if (h > 0) return `${h} h ${m.toString().padStart(2, "0")}`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

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

/** Comme `fmtDate` mais à partir d'un timestamp epoch (ms). */
function fmtDateMs(ms: number | undefined): string {
  return ms ? fmtDate(new Date(ms).toISOString()) : "";
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

/** Bloc « statistiques » du projet en Markdown (KPI + modèles + top outils). */
function projectStatsMarkdown(stats: ProjectStats): string {
  const t = stats.totals;
  const kpi = [
    "## Statistiques",
    "",
    `- **Sessions** : ${fmtNum(t.sessions)} · ${fmtNum(t.messages)} messages (${fmtNum(
      t.userMessages
    )} ↑ / ${fmtNum(t.assistantMessages)} ↓)`,
    `- **Tokens** : ${fmtNum(t.tokensIn + t.tokensOut)} (${fmtNum(t.tokensIn)} in / ${fmtNum(
      t.tokensOut
    )} out)`,
    `- **Coût estimé** : ${fmtUSD(t.costUSD)} _(tarifs indicatifs)_`,
    `- **Outils appelés** : ${fmtNum(t.toolUses)}`,
  ];
  if (stats.totalDurationMs > 0) {
    kpi.push(
      `- **Activité** : ${fmtDuration(stats.totalDurationMs)}${
        stats.firstActivity ? ` (depuis le ${fmtDateMs(stats.firstActivity)})` : ""
      }`
    );
  }

  const parts = [kpi.join("\n")];

  if (stats.models.length > 0) {
    const rows = stats.models.map(
      (m) =>
        `| ${m.label} | ${fmtNum(m.messages)} | ${fmtNum(m.tokensIn)} | ${fmtNum(
          m.tokensOut
        )} | ${fmtNum(m.cacheRead + m.cacheWrite)} | ${fmtUSD(m.costUSD)} |`
    );
    parts.push(
      [
        "### Modèles utilisés",
        "",
        "| Modèle | Msg | In | Out | Cache | Coût |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
        ...rows,
        `| **Total** | ${fmtNum(t.assistantMessages)} | ${fmtNum(t.tokensIn)} | ${fmtNum(
          t.tokensOut
        )} | ${fmtNum(t.cacheRead + t.cacheWrite)} | ${fmtUSD(t.costUSD)} |`,
      ].join("\n")
    );
  }

  if (stats.topTools.length > 0) {
    parts.push(
      [
        "### Outils & skills les plus utilisés",
        "",
        ...stats.topTools.map((tool) => `- \`${tool.name}\` — ${fmtNum(tool.count)}`),
      ].join("\n")
    );
  }

  return parts.join("\n\n");
}

export function projectToMarkdown(
  projectPath: string,
  projectLabel: string,
  sessions: Session[],
  stats: ProjectStats,
  metas: SessionMeta[]
): string {
  const metaById = new Map(metas.map((m) => [m.id, m]));
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
    "## Sessions",
    "",
    ...sessions.map((s, i) => {
      const m = metaById.get(s.id);
      const bits = [`${s.events.length} messages`];
      if (m?.lastModified) bits.push(fmtDateMs(m.lastModified));
      if (m) bits.push(formatSize(m.size));
      return `${i + 1}. [${s.title}](#session-${i + 1}) — ${bits.join(" · ")}`;
    }),
    "",
  ].join("\n");

  const body = sessions
    .map((s, i) => {
      const stamp = `<a id="session-${i + 1}"></a>`;
      const meta = sessionMetaLines(s, projectPath).join("\n");
      return `${stamp}\n\n## ${i + 1}. ${s.title}\n\n[↑ Retour au sommaire](#sessions)\n\n${meta}\n\n${sessionBodyMarkdown(
        s
      )}`;
    })
    .join("\n\n---\n\n");

  return `${header}\n${projectStatsMarkdown(stats)}\n\n${toc}\n---\n\n${body}\n`;
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
  .back { display: inline-block; margin-bottom: 1.25rem; color: #2563eb; text-decoration: none; font-size: .85rem; }
  .back:hover { text-decoration: underline; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; }
  .card > h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin: 0 0 1rem; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .85rem; margin-bottom: 1.5rem; }
  .stat { position: relative; border: 1px solid #e5e7eb; background: #fff; border-radius: 10px; padding: .9rem 1rem; overflow: hidden; }
  .stat::before { content: ""; position: absolute; left: 0; top: 0; height: 1.5rem; width: 2px; background: #7c3aed66; }
  .stat .lbl { font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
  .stat .val { margin-top: .5rem; font: 600 1.4rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .stat .sub { margin-top: .4rem; font-size: .72rem; color: #9ca3af; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  table.stats { width: 100%; border-collapse: collapse; font-size: .85rem; }
  table.stats th { text-align: right; font-weight: 400; font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; padding-bottom: .5rem; }
  table.stats th:first-child { text-align: left; }
  table.stats td { text-align: right; padding: .4rem 0; border-top: 1px solid #eceef1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  table.stats td:first-child { text-align: left; font-family: inherit; }
  table.stats tr.total td { font-weight: 600; }
  .swatch { display: inline-block; width: .65rem; height: .65rem; border-radius: 3px; margin-right: .45rem; vertical-align: middle; }
  .tools { display: flex; flex-direction: column; gap: .5rem; }
  .tool-row { display: flex; align-items: center; gap: .75rem; }
  .tool-row .name { width: 11rem; flex-shrink: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tool-row .bar { flex: 1; height: .5rem; background: #eceef1; border-radius: 999px; overflow: hidden; }
  .tool-row .bar > span { display: block; height: 100%; background: #7c3aed; border-radius: 999px; }
  .tool-row .cnt { width: 3rem; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; color: #6b7280; }
  .session-list { display: flex; flex-direction: column; gap: .6rem; }
  .session-card { display: block; padding: .9rem 1.1rem; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: inherit; transition: border-color .15s; }
  .session-card:hover { border-color: #7c3aed; }
  .session-card .st { font-weight: 500; }
  .session-card .sm { margin-top: .35rem; font-size: .72rem; color: #9ca3af; display: flex; flex-wrap: wrap; gap: .25rem 1rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
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
    details, .card, .stat, .session-card { background: #16181d; }
    .msg .who { color: #f3f4f6; }
    .session-block > h2, .msg { border-color: #23262c; }
    details, .card, .stat, .session-card { border-color: #2a2d34; }
    table.stats td, .tool-row .bar { border-color: #2a2d34; }
    .tool-row .bar { background: #23262c; }
    .md :not(pre) > code { background: #23262c; }
    .md th, .md td { border-color: #2a2d34; }
  }
`;

/** Petit routeur hash : n'affiche que la « page » (.page) ciblée par l'URL. */
const PAGE_SCRIPT = `
(function(){
  function route(){
    var hash = (location.hash || '').replace('#','') || 'overview';
    var pages = document.querySelectorAll('.page');
    var found = false;
    pages.forEach(function(p){ var on = p.id === hash; p.hidden = !on; if(on) found = true; });
    if(!found){ var o = document.getElementById('overview'); if(o) o.hidden = false; }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();
})();
`;

function htmlDocument(title: string, bodyInner: string, script?: string): string {
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
</div>${script ? `\n<script>${script}</script>` : ""}
</body>
</html>`;
}

/** Carte KPI (label + valeur + sous-titre optionnel). */
function statCardHtml(label: string, value: string, sub?: string): string {
  return `<div class="stat"><div class="lbl">${esc(label)}</div><div class="val">${esc(
    value
  )}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
}

/** Bloc « statistiques » du projet en HTML (KPI + modèles + top outils). */
function projectStatsHtml(stats: ProjectStats): string {
  const t = stats.totals;
  const kpis = [
    statCardHtml(
      "Sessions",
      fmtNum(t.sessions),
      `${fmtNum(t.messages)} msg · ${fmtNum(t.userMessages)} ↑ / ${fmtNum(t.assistantMessages)} ↓`
    ),
    statCardHtml(
      "Tokens (in / out)",
      fmtNum(t.tokensIn + t.tokensOut),
      `${fmtNum(t.tokensIn)} ↑ · ${fmtNum(t.tokensOut)} ↓`
    ),
    statCardHtml("Coût estimé", fmtUSD(t.costUSD), "tarifs indicatifs"),
    statCardHtml("Outils appelés", fmtNum(t.toolUses)),
  ];
  if (stats.totalDurationMs > 0) {
    kpis.push(
      statCardHtml(
        "Activité",
        fmtDuration(stats.totalDurationMs),
        stats.firstActivity ? `depuis le ${fmtDateMs(stats.firstActivity)}` : undefined
      )
    );
  }
  const grid = `<div class="kpi-grid">${kpis.join("")}</div>`;

  let modelsCard = "";
  if (stats.models.length > 0) {
    const rows = stats.models
      .map(
        (m) => `<tr>
  <td><span class="swatch" style="background:${m.color}"></span>${esc(m.label)}</td>
  <td>${fmtNum(m.messages)}</td><td>${fmtNum(m.tokensIn)}</td><td>${fmtNum(m.tokensOut)}</td>
  <td>${fmtNum(m.cacheRead + m.cacheWrite)}</td><td>${fmtUSD(m.costUSD)}</td>
</tr>`
      )
      .join("");
    modelsCard = `<section class="card"><h2>Modèles utilisés</h2>
<table class="stats">
<thead><tr><th>Modèle</th><th>Msg</th><th>In</th><th>Out</th><th>Cache</th><th>Coût</th></tr></thead>
<tbody>${rows}
<tr class="total"><td>Total</td><td>${fmtNum(t.assistantMessages)}</td><td>${fmtNum(
      t.tokensIn
    )}</td><td>${fmtNum(t.tokensOut)}</td><td>${fmtNum(t.cacheRead + t.cacheWrite)}</td><td>${fmtUSD(
      t.costUSD
    )}</td></tr>
</tbody></table></section>`;
  }

  let toolsCard = "";
  if (stats.topTools.length > 0) {
    const max = Math.max(1, ...stats.topTools.map((x) => x.count));
    const rows = stats.topTools
      .map(
        (tool) => `<div class="tool-row"><span class="name" title="${esc(tool.name)}">${esc(
          tool.name
        )}</span><span class="bar"><span style="width:${(tool.count / max) * 100}%"></span></span><span class="cnt">${fmtNum(
          tool.count
        )}</span></div>`
      )
      .join("");
    toolsCard = `<section class="card"><h2>Outils &amp; skills les plus utilisés</h2><div class="tools">${rows}</div></section>`;
  }

  return `${grid}${modelsCard}${toolsCard}`;
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
  sessions: Session[],
  stats: ProjectStats,
  metas: SessionMeta[]
): Promise<string> {
  const metaById = new Map(metas.map((m) => [m.id, m]));
  const totalMessages = sessions.reduce((n, s) => n + s.events.length, 0);
  const meta: [string, string][] = [
    ["Projet :", esc(projectPath)],
    ["Sessions :", String(sessions.length)],
    ["Messages :", String(totalMessages)],
  ];

  // Liste de sessions : cartes cliquables qui « ouvrent » leur sous-page (#session-n).
  const sessionCards = sessions
    .map((s, i) => {
      const m = metaById.get(s.id);
      const bits = [`${s.events.length} messages`];
      if (m?.lastModified) bits.push(fmtDateMs(m.lastModified));
      if (m) bits.push(formatSize(m.size));
      return `<a class="session-card" href="#session-${i + 1}">
  <span class="st">${i + 1}. ${esc(s.title)}</span>
  <span class="sm">${bits.map((b) => `<span>${esc(b)}</span>`).join("")}</span>
</a>`;
    })
    .join("\n");

  const overview = `<section class="page" id="overview">
<h1>${esc(projectLabel)}</h1>
${metaBlockHtml(meta)}
${projectStatsHtml(stats)}
<section class="card"><h2>Sessions · ${sessions.length}</h2><div class="session-list">${sessionCards}</div></section>
</section>`;

  // Sous-pages : une par session, masquées par défaut (routeur hash), avec lien retour.
  const pages = (
    await Promise.all(
      sessions.map(async (s, i) => {
        const sMeta: [string, string][] = [["Session :", `<code>${esc(s.id)}</code>`]];
        if (s.gitBranch) sMeta.push(["Branche :", esc(s.gitBranch)]);
        sMeta.push(["Messages :", String(s.events.length)]);
        return `<section class="page session-page" id="session-${i + 1}" hidden>
<a class="back" href="#overview">← ${esc(projectLabel)}</a>
<h1>${esc(s.title)}</h1>
${metaBlockHtml(sMeta)}
${await sessionEventsHtml(s)}
</section>`;
      })
    )
  ).join("\n");

  return htmlDocument(projectLabel, `${overview}\n${pages}`, PAGE_SCRIPT);
}
