import { createElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, Session, SessionMeta } from "./projects";
import type { ProjectStats } from "./analytics";
import { formatSize } from "./claude";
import type { ServerI18n } from "./i18n";
import type { Language } from "./i18n/core";

/**
 * Export **lecture seule** d'une session (ou d'un projet entier) en Markdown ou
 * HTML autonome, pour partage/archive. Aucune écriture dans ~/.claude : le rendu
 * est produit à la volée et servi en téléchargement par `/api/export`.
 *
 * Les libellés de l'app (titres, en-têtes, unités…) sont traduits selon la langue
 * de claudeboard : chaque fonction d'export reçoit un `ServerI18n` (cf. `getT`) que
 * l'on transforme en `ExportCtx` (traduction + formatage localisé). Le contenu venant
 * des transcripts (titres de session, messages, outils) n'est jamais traduit.
 */

export type ExportFormat = "md" | "html";

/** Tag Intl par langue (formatage des nombres, montants, dates). */
const LOCALE_TAG: Record<Language, string> = { fr: "fr-FR", en: "en-US" };

/**
 * Contexte d'export : traduction (`t`) + formatage localisé. Construit une fois par
 * export et propagé à tous les helpers pour éviter de reconstruire les `Intl.*`.
 */
interface ExportCtx {
  t: ServerI18n["t"];
  locale: Language;
  fmtNum: (n: number) => string;
  fmtUSD: (n: number) => string;
  fmtDuration: (ms: number) => string;
  fmtDate: (ts: string | undefined) => string;
  fmtDateMs: (ms: number | undefined) => string;
  role: (r: Session["events"][number]["role"]) => string;
}

function makeCtx(i18n: ServerI18n): ExportCtx {
  const tag = LOCALE_TAG[i18n.locale] ?? "fr-FR";
  const t = i18n.t;
  const compactNum = new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 });
  const fullNum = new Intl.NumberFormat(tag);

  /** Nombre compact au-delà de 10 000 (comme sur les pages du dashboard). */
  const fmtNum = (n: number): string =>
    n >= 10000 ? compactNum.format(n) : fullNum.format(n);

  const fmtUSD = (n: number): string => {
    if (n > 0 && n < 0.01) return t("export.cost.under");
    const num = n.toLocaleString(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return i18n.locale === "en" ? `$${num}` : `${num} $`;
  };

  /** Durée active « 2j 05h 30min » / « 3 h 05 » / « 12 min » (comme la page projet). */
  const fmtDuration = (ms: number): string => {
    if (ms <= 0) return "—";
    const s = Math.round(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const uD = t("export.dur.d");
    const uH = t("export.dur.h");
    const uMin = t("export.dur.min");
    const uS = t("export.dur.s");
    if (h >= 24) {
      const d = Math.floor(h / 24);
      return `${d}${uD} ${(h % 24).toString().padStart(2, "0")}${uH} ${m
        .toString()
        .padStart(2, "0")}${uMin}`;
    }
    if (h > 0) return `${h} ${uH} ${m.toString().padStart(2, "0")}`;
    if (m > 0) return `${m} ${uMin}`;
    return `${s} ${uS}`;
  };

  const fmtDate = (ts: string | undefined): string => {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(tag, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /** Comme `fmtDate` mais à partir d'un timestamp epoch (ms). */
  const fmtDateMs = (ms: number | undefined): string =>
    ms ? fmtDate(new Date(ms).toISOString()) : "";

  const role = (r: Session["events"][number]["role"]): string =>
    r === "user" ? t("export.role.user") : "Claude";

  return { t, locale: i18n.locale, fmtNum, fmtUSD, fmtDuration, fmtDate, fmtDateMs, role };
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

function blockToMarkdown(block: Block, ctx: ExportCtx): string {
  switch (block.kind) {
    case "text":
      return block.text.trim();
    case "thinking":
      return `<details>\n<summary>💭 ${ctx.t("export.block.thinking")}</summary>\n\n${block.text.trim()}\n\n</details>`;
    case "tool_use":
      return `<details>\n<summary>🔧 ${ctx.t("export.block.tool")} ${block.name}</summary>\n\n\`\`\`json\n${JSON.stringify(
        block.input,
        null,
        2
      )}\n\`\`\`\n\n</details>`;
    case "tool_result": {
      const label = block.isError
        ? `⚠️ ${ctx.t("export.block.toolResultError")}`
        : `📤 ${ctx.t("export.block.toolResult")}`;
      return `<details>\n<summary>${label}</summary>\n\n\`\`\`\n${block.text.trim()}\n\`\`\`\n\n</details>`;
    }
  }
}

function sessionBodyMarkdown(session: Session, ctx: ExportCtx): string {
  const parts: string[] = [];
  for (const ev of session.events) {
    const stamp = ctx.fmtDate(ev.timestamp);
    const icon = ev.role === "user" ? "🧑" : "🤖";
    parts.push(`### ${icon} ${ctx.role(ev.role)}${stamp ? ` · ${stamp}` : ""}`);
    const rendered = ev.blocks.map((b) => blockToMarkdown(b, ctx)).filter(Boolean);
    parts.push(rendered.join("\n\n"));
  }
  return parts.join("\n\n");
}

function sessionMetaLines(session: Session, projectPath: string, ctx: ExportCtx): string[] {
  const lines = [
    `- **${ctx.t("export.meta.project")}** : ${projectPath}`,
    `- **${ctx.t("export.meta.session")}** : \`${session.id}\``,
    `- **${ctx.t("export.meta.messages")}** : ${session.events.length}`,
  ];
  if (session.gitBranch)
    lines.splice(2, 0, `- **${ctx.t("export.meta.branch")}** : ${session.gitBranch}`);
  if (session.version) lines.push(`- **${ctx.t("export.meta.version")}** : ${session.version}`);
  return lines;
}

export function sessionToMarkdown(
  session: Session,
  projectPath: string,
  i18n: ServerI18n
): string {
  const ctx = makeCtx(i18n);
  const header = [
    `# ${session.title}`,
    "",
    `> ${ctx.t("export.generated", { date: ctx.fmtDate(new Date().toISOString()) })}`,
    "",
    ...sessionMetaLines(session, projectPath, ctx),
    "",
    "---",
    "",
  ].join("\n");
  return `${header}${sessionBodyMarkdown(session, ctx)}\n`;
}

/** Bloc « statistiques » du projet en Markdown (KPI + modèles + top outils). */
function projectStatsMarkdown(stats: ProjectStats, ctx: ExportCtx): string {
  const t = stats.totals;
  const kpi = [
    `## ${ctx.t("export.stats.title")}`,
    "",
    `- **${ctx.t("export.stats.sessions")}** : ${ctx.fmtNum(t.sessions)} · ${ctx.fmtNum(
      t.messages
    )} ${ctx.t("export.stats.messagesInline")} (${ctx.fmtNum(t.userMessages)} ↑ / ${ctx.fmtNum(
      t.assistantMessages
    )} ↓)`,
    `- **${ctx.t("export.stats.tokens")}** : ${ctx.fmtNum(t.tokensIn + t.tokensOut)} (${ctx.fmtNum(
      t.tokensIn
    )} ${ctx.t("export.stats.in")} / ${ctx.fmtNum(t.tokensOut)} ${ctx.t("export.stats.out")})`,
    `- **${ctx.t("export.stats.cost")}** : ${ctx.fmtUSD(t.costUSD)} _(${ctx.t(
      "export.stats.costHint"
    )})_`,
    `- **${ctx.t("export.stats.tools")}** : ${ctx.fmtNum(t.toolUses)}`,
  ];
  if (stats.totalDurationMs > 0) {
    kpi.push(
      `- **${ctx.t("export.stats.activity")}** : ${ctx.fmtDuration(stats.totalDurationMs)}${
        stats.firstActivity
          ? ` (${ctx.t("export.stats.since", { date: ctx.fmtDateMs(stats.firstActivity) })})`
          : ""
      }`
    );
  }

  const parts = [kpi.join("\n")];

  if (stats.models.length > 0) {
    const rows = stats.models.map(
      (m) =>
        `| ${m.label} | ${ctx.fmtNum(m.messages)} | ${ctx.fmtNum(m.tokensIn)} | ${ctx.fmtNum(
          m.tokensOut
        )} | ${ctx.fmtNum(m.cacheRead + m.cacheWrite)} | ${ctx.fmtUSD(m.costUSD)} |`
    );
    parts.push(
      [
        `### ${ctx.t("export.stats.models")}`,
        "",
        `| ${ctx.t("export.table.model")} | ${ctx.t("export.table.msg")} | ${ctx.t(
          "export.table.in"
        )} | ${ctx.t("export.table.out")} | ${ctx.t("export.table.cache")} | ${ctx.t(
          "export.table.cost"
        )} |`,
        "| --- | ---: | ---: | ---: | ---: | ---: |",
        ...rows,
        `| **${ctx.t("export.table.total")}** | ${ctx.fmtNum(t.assistantMessages)} | ${ctx.fmtNum(
          t.tokensIn
        )} | ${ctx.fmtNum(t.tokensOut)} | ${ctx.fmtNum(t.cacheRead + t.cacheWrite)} | ${ctx.fmtUSD(
          t.costUSD
        )} |`,
      ].join("\n")
    );
  }

  if (stats.topTools.length > 0) {
    parts.push(
      [
        `### ${ctx.t("export.stats.toolsTop")}`,
        "",
        ...stats.topTools.map((tool) => `- \`${tool.name}\` — ${ctx.fmtNum(tool.count)}`),
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
  metas: SessionMeta[],
  i18n: ServerI18n,
  includeStats = true
): string {
  const ctx = makeCtx(i18n);
  const metaById = new Map(metas.map((m) => [m.id, m]));
  const totalMessages = sessions.reduce((n, s) => n + s.events.length, 0);
  const header = [
    `# ${projectLabel}`,
    "",
    `> ${ctx.t("export.generated", { date: ctx.fmtDate(new Date().toISOString()) })}`,
    "",
    `- **${ctx.t("export.meta.project")}** : ${projectPath}`,
    // Sessions/Messages sont déjà dans les KPI → on ne les répète dans l'en-tête
    // que si les statistiques ne sont pas incluses.
    ...(includeStats
      ? []
      : [
          `- **${ctx.t("export.meta.sessions")}** : ${sessions.length}`,
          `- **${ctx.t("export.meta.messages")}** : ${totalMessages}`,
        ]),
    "",
  ].join("\n");

  const toc = [
    `## ${ctx.t("export.toc.sessions")}`,
    "",
    ...sessions.map((s, i) => {
      const m = metaById.get(s.id);
      const bits = [`${s.events.length} ${ctx.t("export.toc.messages")}`];
      if (m?.lastModified) bits.push(ctx.fmtDateMs(m.lastModified));
      if (m) bits.push(formatSize(m.size));
      return `${i + 1}. [${s.title}](#session-${i + 1}) — ${bits.join(" · ")}`;
    }),
    "",
  ].join("\n");

  const body = sessions
    .map((s, i) => {
      const stamp = `<a id="session-${i + 1}"></a>`;
      const meta = sessionMetaLines(s, projectPath, ctx).join("\n");
      return `${stamp}\n\n## ${i + 1}. ${s.title}\n\n[↑ ${ctx.t(
        "export.toc.back"
      )}](#sessions)\n\n${meta}\n\n${sessionBodyMarkdown(s, ctx)}`;
    })
    .join("\n\n---\n\n");

  const statsBlock = includeStats ? `${projectStatsMarkdown(stats, ctx)}\n\n` : "";
  return `${header}\n${statsBlock}${toc}\n---\n\n${body}\n`;
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

async function blockToHtml(block: Block, ctx: ExportCtx): Promise<string> {
  switch (block.kind) {
    case "text":
      return `<div class="md">${await mdToHtml(block.text)}</div>`;
    case "thinking":
      return `<details class="thinking"><summary>💭 ${esc(
        ctx.t("export.block.thinking")
      )}</summary><pre>${esc(block.text)}</pre></details>`;
    case "tool_use":
      return `<details class="tool"><summary>🔧 ${esc(ctx.t("export.block.tool"))} ${esc(
        block.name
      )}</summary><pre>${esc(JSON.stringify(block.input, null, 2))}</pre></details>`;
    case "tool_result": {
      const label = block.isError
        ? `⚠️ ${esc(ctx.t("export.block.toolResultError"))}`
        : `📤 ${esc(ctx.t("export.block.toolResult"))}`;
      return `<details class="tool${block.isError ? " error" : ""}"><summary>${label}</summary><pre>${esc(
        block.text
      )}</pre></details>`;
    }
  }
}

async function sessionEventsHtml(session: Session, ctx: ExportCtx): Promise<string> {
  const events = await Promise.all(
    session.events.map(async (ev) => {
      const stamp = ctx.fmtDate(ev.timestamp);
      const cls = ev.role === "user" ? "user" : "assistant";
      const icon = ev.role === "user" ? "🧑" : "🤖";
      const blocks = (await Promise.all(ev.blocks.map((b) => blockToHtml(b, ctx)))).join("\n");
      return `<article class="msg ${cls}">
  <header><span class="who">${icon} ${esc(ctx.role(ev.role))}</span>${
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

function htmlDocument(title: string, bodyInner: string, lang: Language, script?: string): string {
  return `<!doctype html>
<html lang="${lang}">
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
function projectStatsHtml(stats: ProjectStats, ctx: ExportCtx): string {
  const t = stats.totals;
  const kpis = [
    statCardHtml(
      ctx.t("export.stats.sessions"),
      ctx.fmtNum(t.sessions),
      `${ctx.fmtNum(t.messages)} ${ctx.t("export.stats.messagesInline")} · ${ctx.fmtNum(
        t.userMessages
      )} ↑ / ${ctx.fmtNum(t.assistantMessages)} ↓`
    ),
    statCardHtml(
      ctx.t("export.stats.tokensInOut"),
      ctx.fmtNum(t.tokensIn + t.tokensOut),
      `${ctx.fmtNum(t.tokensIn)} ↑ · ${ctx.fmtNum(t.tokensOut)} ↓`
    ),
    statCardHtml(ctx.t("export.stats.cost"), ctx.fmtUSD(t.costUSD), ctx.t("export.stats.costHint")),
    statCardHtml(ctx.t("export.stats.tools"), ctx.fmtNum(t.toolUses)),
  ];
  if (stats.totalDurationMs > 0) {
    kpis.push(
      statCardHtml(
        ctx.t("export.stats.activity"),
        ctx.fmtDuration(stats.totalDurationMs),
        stats.firstActivity
          ? ctx.t("export.stats.since", { date: ctx.fmtDateMs(stats.firstActivity) })
          : undefined
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
  <td>${ctx.fmtNum(m.messages)}</td><td>${ctx.fmtNum(m.tokensIn)}</td><td>${ctx.fmtNum(m.tokensOut)}</td>
  <td>${ctx.fmtNum(m.cacheRead + m.cacheWrite)}</td><td>${ctx.fmtUSD(m.costUSD)}</td>
</tr>`
      )
      .join("");
    modelsCard = `<section class="card"><h2>${esc(ctx.t("export.stats.models"))}</h2>
<table class="stats">
<thead><tr><th>${esc(ctx.t("export.table.model"))}</th><th>${esc(
      ctx.t("export.table.msg")
    )}</th><th>${esc(ctx.t("export.table.in"))}</th><th>${esc(
      ctx.t("export.table.out")
    )}</th><th>${esc(ctx.t("export.table.cache"))}</th><th>${esc(
      ctx.t("export.table.cost")
    )}</th></tr></thead>
<tbody>${rows}
<tr class="total"><td>${esc(ctx.t("export.table.total"))}</td><td>${ctx.fmtNum(
      t.assistantMessages
    )}</td><td>${ctx.fmtNum(t.tokensIn)}</td><td>${ctx.fmtNum(t.tokensOut)}</td><td>${ctx.fmtNum(
      t.cacheRead + t.cacheWrite
    )}</td><td>${ctx.fmtUSD(t.costUSD)}</td></tr>
</tbody></table></section>`;
  }

  let toolsCard = "";
  if (stats.topTools.length > 0) {
    const max = Math.max(1, ...stats.topTools.map((x) => x.count));
    const rows = stats.topTools
      .map(
        (tool) => `<div class="tool-row"><span class="name" title="${esc(tool.name)}">${esc(
          tool.name
        )}</span><span class="bar"><span style="width:${(tool.count / max) * 100}%"></span></span><span class="cnt">${ctx.fmtNum(
          tool.count
        )}</span></div>`
      )
      .join("");
    toolsCard = `<section class="card"><h2>${esc(
      ctx.t("export.stats.toolsTop")
    )}</h2><div class="tools">${rows}</div></section>`;
  }

  return `${grid}${modelsCard}${toolsCard}`;
}

function metaBlockHtml(lines: [string, string][], ctx: ExportCtx): string {
  const items = lines
    .map(([k, v]) => `<li><strong>${esc(k)}</strong> ${v}</li>`)
    .join("");
  return `<div class="meta"><div>${esc(
    ctx.t("export.generated", { date: ctx.fmtDate(new Date().toISOString()) })
  )}</div><ul>${items}</ul></div>`;
}

export async function sessionToHtml(
  session: Session,
  projectPath: string,
  i18n: ServerI18n
): Promise<string> {
  const ctx = makeCtx(i18n);
  const meta: [string, string][] = [[`${ctx.t("export.meta.project")} :`, esc(projectPath)]];
  if (session.gitBranch) meta.push([`${ctx.t("export.meta.branch")} :`, esc(session.gitBranch)]);
  if (session.version) meta.push([`${ctx.t("export.meta.version")} :`, esc(session.version)]);
  meta.push([`${ctx.t("export.meta.session")} :`, `<code>${esc(session.id)}</code>`]);
  meta.push([`${ctx.t("export.meta.messages")} :`, String(session.events.length)]);

  const inner = `<h1>${esc(session.title)}</h1>
${metaBlockHtml(meta, ctx)}
${await sessionEventsHtml(session, ctx)}`;
  return htmlDocument(session.title, inner, ctx.locale);
}

export async function projectToHtml(
  projectPath: string,
  projectLabel: string,
  sessions: Session[],
  stats: ProjectStats,
  metas: SessionMeta[],
  i18n: ServerI18n,
  includeStats = true
): Promise<string> {
  const ctx = makeCtx(i18n);
  const metaById = new Map(metas.map((m) => [m.id, m]));
  const totalMessages = sessions.reduce((n, s) => n + s.events.length, 0);
  // Sessions/Messages sont déjà dans les KPI → on ne les répète dans l'en-tête que
  // si les statistiques ne sont pas incluses (sinon doublon au-dessus des KPI).
  const meta: [string, string][] = [[`${ctx.t("export.meta.project")} :`, esc(projectPath)]];
  if (!includeStats) {
    meta.push(
      [`${ctx.t("export.meta.sessions")} :`, String(sessions.length)],
      [`${ctx.t("export.meta.messages")} :`, String(totalMessages)]
    );
  }

  // Liste de sessions : cartes cliquables qui « ouvrent » leur sous-page (#session-n).
  const sessionCards = sessions
    .map((s, i) => {
      const m = metaById.get(s.id);
      const bits = [`${s.events.length} ${ctx.t("export.toc.messages")}`];
      if (m?.lastModified) bits.push(ctx.fmtDateMs(m.lastModified));
      if (m) bits.push(formatSize(m.size));
      return `<a class="session-card" href="#session-${i + 1}">
  <span class="st">${i + 1}. ${esc(s.title)}</span>
  <span class="sm">${bits.map((b) => `<span>${esc(b)}</span>`).join("")}</span>
</a>`;
    })
    .join("\n");

  const overview = `<section class="page" id="overview">
<h1>${esc(projectLabel)}</h1>
${metaBlockHtml(meta, ctx)}
${includeStats ? projectStatsHtml(stats, ctx) : ""}
<section class="card"><h2>${esc(ctx.t("export.toc.sessions"))} · ${
    sessions.length
  }</h2><div class="session-list">${sessionCards}</div></section>
</section>`;

  // Sous-pages : une par session, masquées par défaut (routeur hash), avec lien retour.
  const pages = (
    await Promise.all(
      sessions.map(async (s, i) => {
        const sMeta: [string, string][] = [
          [`${ctx.t("export.meta.session")} :`, `<code>${esc(s.id)}</code>`],
        ];
        if (s.gitBranch) sMeta.push([`${ctx.t("export.meta.branch")} :`, esc(s.gitBranch)]);
        sMeta.push([`${ctx.t("export.meta.messages")} :`, String(s.events.length)]);
        return `<section class="page session-page" id="session-${i + 1}" hidden>
<a class="back" href="#overview">← ${esc(projectLabel)}</a>
<h1>${esc(s.title)}</h1>
${metaBlockHtml(sMeta, ctx)}
${await sessionEventsHtml(s, ctx)}
</section>`;
      })
    )
  ).join("\n");

  return htmlDocument(projectLabel, `${overview}\n${pages}`, ctx.locale, PAGE_SCRIPT);
}
