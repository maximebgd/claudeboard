import fs from "fs/promises";
import path from "path";
import { safeResolve } from "./claude";
import { moveToTrash } from "./trash";

const PROJECTS_DIR = "projects";

export interface ProjectMeta {
  id: string; // nom de dossier encodé (ex. -Users-maxx-Desktop-foo)
  realPath: string; // cwd réel si retrouvé, sinon décodage naïf
  sessionCount: number;
  createdAt: number; // naissance du plus ancien fichier de session (proxy d'ancienneté)
  lastModified: number;
}

export interface SessionMeta {
  id: string; // nom de fichier sans .jsonl
  title: string;
  messageCount: number;
  lastModified: number;
  size: number;
}

/** Bloc normalisé d'un message. */
export type Block =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tool_use"; name: string; input: unknown }
  | { kind: "tool_result"; text: string; isError: boolean };

export interface SessionEvent {
  uuid: string;
  role: "user" | "assistant";
  timestamp?: string;
  blocks: Block[];
}

export interface Session {
  id: string;
  title: string;
  projectId: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  events: SessionEvent[];
}

async function readProjectFiles(projectId: string): Promise<string[]> {
  const pdir = safeResolve(PROJECTS_DIR, projectId);
  const files = await fs.readdir(pdir);
  return files.filter((f) => f.endsWith(".jsonl"));
}

/** Décodage naïf du nom de dossier vers un chemin (best-effort, lossy). */
function naiveDecode(id: string): string {
  return id.replace(/^-/, "/").replace(/-/g, "/");
}

/** Cherche le vrai `cwd` en scannant le début du premier fichier de session. */
async function findRealPath(projectId: string, files: string[]): Promise<string> {
  for (const f of files) {
    const fp = safeResolve(PROJECTS_DIR, projectId, f);
    try {
      const raw = await fs.readFile(fp, "utf8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const d = JSON.parse(line);
          if (typeof d.cwd === "string" && d.cwd) return d.cwd;
        } catch {
          /* ligne non JSON */
        }
      }
    } catch {
      /* fichier illisible */
    }
  }
  return naiveDecode(projectId);
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const dir = safeResolve(PROJECTS_DIR);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: ProjectMeta[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    let files: string[];
    try {
      files = await readProjectFiles(e.name);
    } catch {
      continue;
    }
    if (files.length === 0) continue;
    let lastModified = 0;
    let createdAt = Infinity;
    for (const f of files) {
      const st = await fs.stat(safeResolve(PROJECTS_DIR, e.name, f));
      lastModified = Math.max(lastModified, st.mtimeMs);
      // birthtime n'est pas toujours fiable (0 sur certains FS) → repli sur mtime.
      const born = st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs;
      createdAt = Math.min(createdAt, born);
    }
    if (!Number.isFinite(createdAt)) createdAt = lastModified;
    const realPath = await findRealPath(e.name, files);
    out.push({ id: e.name, realPath, sessionCount: files.length, createdAt, lastModified });
  }
  return out.sort((a, b) => b.lastModified - a.lastModified);
}

export async function listSessions(projectId: string): Promise<SessionMeta[]> {
  let files: string[];
  try {
    files = await readProjectFiles(projectId);
  } catch {
    return [];
  }
  const out: SessionMeta[] = [];
  for (const f of files) {
    const fp = safeResolve(PROJECTS_DIR, projectId, f);
    const st = await fs.stat(fp);
    const raw = await fs.readFile(fp, "utf8");
    let title = "";
    let messageCount = 0;
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const d = JSON.parse(line);
        if (d.type === "ai-title" && d.aiTitle) title = d.aiTitle;
        if (d.type === "user" || d.type === "assistant") messageCount++;
      } catch {
        /* ignore */
      }
    }
    out.push({
      id: f.replace(/\.jsonl$/, ""),
      title: title || "(sans titre)",
      messageCount,
      lastModified: st.mtimeMs,
      size: st.size,
    });
  }
  return out.sort((a, b) => b.lastModified - a.lastModified);
}

function normalizeContent(content: unknown): Block[] {
  if (typeof content === "string") {
    return content.trim() ? [{ kind: "text", text: content }] : [];
  }
  if (!Array.isArray(content)) return [];
  const blocks: Block[] = [];
  for (const b of content) {
    if (!b || typeof b !== "object") continue;
    const t = (b as { type?: string }).type;
    const rec = b as Record<string, unknown>;
    if (t === "text") blocks.push({ kind: "text", text: String(rec.text ?? "") });
    else if (t === "thinking")
      blocks.push({ kind: "thinking", text: String(rec.thinking ?? rec.text ?? "") });
    else if (t === "tool_use")
      blocks.push({ kind: "tool_use", name: String(rec.name ?? "tool"), input: rec.input });
    else if (t === "tool_result") {
      let text = "";
      const c = rec.content;
      if (typeof c === "string") text = c;
      else if (Array.isArray(c))
        text = c
          .map((x) => (x && typeof x === "object" && "text" in x ? String((x as { text: unknown }).text) : ""))
          .join("\n");
      blocks.push({ kind: "tool_result", text, isError: Boolean(rec.is_error) });
    }
  }
  return blocks;
}

export async function getSession(projectId: string, sessionId: string): Promise<Session | null> {
  const fp = safeResolve(PROJECTS_DIR, projectId, `${sessionId}.jsonl`);
  let raw: string;
  try {
    raw = await fs.readFile(fp, "utf8");
  } catch {
    return null;
  }
  const events: SessionEvent[] = [];
  let title = "";
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let version: string | undefined;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d.type === "ai-title" && d.aiTitle) title = String(d.aiTitle);
    if (typeof d.cwd === "string" && !cwd) cwd = d.cwd;
    if (typeof d.gitBranch === "string" && d.gitBranch) gitBranch = d.gitBranch;
    if (typeof d.version === "string" && !version) version = d.version;
    if (d.type === "user" || d.type === "assistant") {
      const msg = d.message as { content?: unknown } | undefined;
      const blocks = normalizeContent(msg?.content);
      if (blocks.length === 0) continue;
      events.push({
        uuid: String(d.uuid ?? Math.random()),
        role: d.type,
        timestamp: d.timestamp as string | undefined,
        blocks,
      });
    }
  }
  return {
    id: sessionId,
    title: title || "(sans titre)",
    projectId,
    cwd,
    gitBranch,
    version,
    events,
  };
}

/** Nom court lisible d'un projet (dernier segment du chemin réel). */
export function projectLabel(realPath: string): string {
  const base = path.basename(realPath);
  return base || realPath;
}

/** Supprime un projet entier (déplace son dossier dans la corbeille, réversible). */
export async function deleteProject(projectId: string): Promise<string> {
  const dir = safeResolve(PROJECTS_DIR, projectId);
  return moveToTrash(dir);
}

/** Supprime une session (déplace son `.jsonl` dans la corbeille, réversible). */
export async function deleteSession(projectId: string, sessionId: string): Promise<string> {
  const fp = safeResolve(PROJECTS_DIR, projectId, `${sessionId}.jsonl`);
  return moveToTrash(fp);
}
