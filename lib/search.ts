import { createReadStream } from "fs";
import fs from "fs/promises";
import readline from "readline";
import path from "path";
import { safeResolve } from "./claude";

const PROJECTS_DIR = "projects";

/** Type de bloc où la correspondance a été trouvée. */
export type MatchKind = "text" | "thinking" | "tool_result";

export interface SearchMatch {
  role: "user" | "assistant";
  kind: MatchKind;
  timestamp?: string;
  /** Extrait de texte autour de la correspondance (avec « … » si tronqué). */
  snippet: string;
}

export interface SearchSessionResult {
  projectId: string;
  projectLabel: string;
  sessionId: string;
  title: string;
  lastModified: number;
  /** Nombre de blocs contenant la requête dans cette session. */
  matchCount: number;
  /** Quelques extraits représentatifs (plafonnés, cf. MAX_SNIPPETS_PER_SESSION). */
  matches: SearchMatch[];
}

export interface SearchOptions {
  /** Limiter la recherche à un seul projet (id de dossier). */
  projectId?: string;
  /** Inclure les blocs de réflexion (`thinking`) de l'assistant. */
  includeThinking?: boolean;
  /** Inclure les résultats d'outils (`tool_result`). */
  includeToolResults?: boolean;
}

export interface SearchResults {
  query: string;
  totalMatches: number;
  totalSessions: number;
  results: SearchSessionResult[];
  /** `true` si le nombre de sessions dépasse la limite d'affichage. */
  truncated: boolean;
  scannedFiles: number;
  elapsedMs: number;
}

/** Longueur minimale d'une requête pour éviter de scanner sur une chaîne triviale. */
export const MIN_QUERY_LENGTH = 2;

/** Nombre max de sessions renvoyées (les plus récentes d'abord). */
const MAX_SESSIONS = 100;

/** Nombre max d'extraits conservés par session (le comptage, lui, reste exhaustif). */
const MAX_SNIPPETS_PER_SESSION = 4;

/** Demi-largeur (en caractères) de la fenêtre de contexte autour d'une correspondance. */
const SNIPPET_RADIUS = 90;

const DIACRITIC = /[̀-ͯ]/g;

/**
 * Repli **préservant la longueur** : minuscule + suppression des diacritiques, en
 * émettant exactement un caractère par unité de code d'entrée. Les accents
 * précomposés (« é ») se réduisent à leur base (« e ») sans décaler les index — ce
 * qui permet de réutiliser la position trouvée pour découper la chaîne d'origine.
 */
function fold(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const f = c.normalize("NFD").replace(DIACRITIC, "").toLowerCase();
    out += f.length === 1 ? f : c.toLowerCase();
  }
  return out;
}

/** Décodage naïf du nom de dossier vers un chemin (best-effort, lossy). */
function naiveDecode(id: string): string {
  return id.replace(/^-/, "/").replace(/-/g, "/");
}

/**
 * Construit un extrait lisible autour de la première occurrence de `needleFolded`
 * dans `text`. `foldedText` est le repli aligné de `text` (mêmes index).
 */
function makeSnippet(text: string, foldedText: string, needleFolded: string): string | null {
  const idx = foldedText.indexOf(needleFolded);
  if (idx === -1) return null;
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + needleFolded.length + SNIPPET_RADIUS);
  let snip = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snip = "… " + snip;
  if (end < text.length) snip = snip + " …";
  return snip;
}

/** Extrait les segments textuels d'une ligne de transcript (selon les options). */
function* lineSegments(
  o: Record<string, unknown>,
  includeThinking: boolean,
  includeToolResults: boolean,
): Generator<{ kind: MatchKind; text: string }> {
  const m = (o.message ?? {}) as Record<string, unknown>;
  const content = m.content;
  if (typeof content === "string") {
    if (content.trim()) yield { kind: "text", text: content };
    return;
  }
  if (!Array.isArray(content)) return;
  for (const b of content) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const type = rec.type;
    if (type === "text") {
      const t = String(rec.text ?? "");
      if (t) yield { kind: "text", text: t };
    } else if (type === "thinking" && includeThinking) {
      const t = String(rec.thinking ?? rec.text ?? "");
      if (t) yield { kind: "thinking", text: t };
    } else if (type === "tool_result" && includeToolResults) {
      const c = rec.content;
      let t = "";
      if (typeof c === "string") t = c;
      else if (Array.isArray(c))
        t = c
          .map((x) => (x && typeof x === "object" && "text" in x ? String((x as { text: unknown }).text) : ""))
          .join("\n");
      if (t.trim()) yield { kind: "tool_result", text: t };
    }
  }
}

/** Scanne un fichier de session en streaming et accumule ses correspondances. */
async function searchFile(
  filePath: string,
  projectId: string,
  sessionId: string,
  needleFolded: string,
  opts: Required<Pick<SearchOptions, "includeThinking" | "includeToolResults">>,
): Promise<{ matchCount: number; matches: SearchMatch[]; title: string; cwd?: string } | null> {
  let rl: readline.Interface;
  try {
    rl = readline.createInterface({
      input: createReadStream(filePath, "utf8"),
      crlfDelay: Infinity,
    });
  } catch {
    return null;
  }

  let matchCount = 0;
  const matches: SearchMatch[] = [];
  let title = "";
  let cwd: string | undefined;

  for await (const line of rl) {
    if (!line.trim()) continue;
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type === "ai-title" && o.aiTitle) title = String(o.aiTitle);
    if (typeof o.cwd === "string" && !cwd) cwd = o.cwd;
    const role = o.type;
    if (role !== "user" && role !== "assistant") continue;

    const timestamp = typeof o.timestamp === "string" ? o.timestamp : undefined;
    for (const seg of lineSegments(o, opts.includeThinking, opts.includeToolResults)) {
      const foldedText = fold(seg.text);
      if (!foldedText.includes(needleFolded)) continue;
      matchCount++;
      if (matches.length < MAX_SNIPPETS_PER_SESSION) {
        const snippet = makeSnippet(seg.text, foldedText, needleFolded);
        if (snippet) matches.push({ role, kind: seg.kind, timestamp, snippet });
      }
    }
  }

  if (matchCount === 0) return null;
  return { matchCount, matches, title, cwd };
}

/**
 * Recherche full-text dans **tous** les transcripts JSONL de `~/.claude/projects`.
 * Chaque fichier est lu en **streaming** (ligne par ligne, sans charger tout le
 * fichier en mémoire) ; la casse et les accents sont ignorés. Les résultats sont
 * regroupés par session, triés du plus récent au plus ancien, et plafonnés à
 * MAX_SESSIONS (le comptage global des correspondances reste exhaustif).
 */
export async function searchTranscripts(query: string, opts: SearchOptions = {}): Promise<SearchResults> {
  const started = Date.now();
  const trimmed = query.trim();
  const includeThinking = opts.includeThinking ?? false;
  const includeToolResults = opts.includeToolResults ?? false;

  const empty: SearchResults = {
    query: trimmed,
    totalMatches: 0,
    totalSessions: 0,
    results: [],
    truncated: false,
    scannedFiles: 0,
    elapsedMs: 0,
  };
  if (trimmed.length < MIN_QUERY_LENGTH) return empty;

  const needleFolded = fold(trimmed);
  const dir = safeResolve(PROJECTS_DIR);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { ...empty, elapsedMs: Date.now() - started };
  }

  const all: SearchSessionResult[] = [];
  let totalMatches = 0;
  let scannedFiles = 0;

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (opts.projectId && e.name !== opts.projectId) continue;
    let files: string[];
    try {
      files = (await fs.readdir(safeResolve(PROJECTS_DIR, e.name))).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const file of files) {
      const filePath = safeResolve(PROJECTS_DIR, e.name, file);
      let lastModified = 0;
      try {
        lastModified = (await fs.stat(filePath)).mtimeMs;
      } catch {
        continue;
      }
      scannedFiles++;
      const res = await searchFile(filePath, e.name, file, needleFolded, {
        includeThinking,
        includeToolResults,
      });
      if (!res) continue;
      totalMatches += res.matchCount;
      all.push({
        projectId: e.name,
        projectLabel: path.basename(res.cwd || naiveDecode(e.name)) || e.name,
        sessionId: file.replace(/\.jsonl$/, ""),
        title: res.title || "(sans titre)",
        lastModified,
        matchCount: res.matchCount,
        matches: res.matches,
      });
    }
  }

  all.sort((a, b) => b.lastModified - a.lastModified);
  const truncated = all.length > MAX_SESSIONS;

  return {
    query: trimmed,
    totalMatches,
    totalSessions: all.length,
    results: all.slice(0, MAX_SESSIONS),
    truncated,
    scannedFiles,
    elapsedMs: Date.now() - started,
  };
}
