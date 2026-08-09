import fs from "fs/promises";
import path from "path";
import { CLAUDE_DIR, safeResolve } from "./claude";

/**
 * Lecture SEULE des serveurs MCP configurés. Contrairement au reste de l'app,
 * la config MCP vit dans `~/.claude.json` — HORS de CLAUDE_DIR, et dans un
 * fichier qui contient aussi des secrets (oauth, caches). On ne lit donc que
 * les clés `mcpServers` (globales + par projet) et on n'expose jamais les
 * valeurs d'`env` (uniquement les noms de variables).
 *
 * Le statut d'authentification est dérivé de
 * `~/.claude/mcp-needs-auth-cache.json` (dans CLAUDE_DIR, via safeResolve).
 */

/** `~/.claude.json` — sibling de CLAUDE_DIR (respecte un override CLAUDE_DIR). */
const CLAUDE_JSON = path.join(path.dirname(CLAUDE_DIR), ".claude.json");
const AUTH_CACHE = "mcp-needs-auth-cache.json";

export interface McpServer {
  name: string;
  transport: "stdio" | "sse" | "http" | "unknown";
  command: string | null;
  args: string[];
  url: string | null;
  cwd: string | null;
  envKeys: string[]; // noms de variables uniquement, jamais les valeurs
  needsAuth: boolean;
}

export interface McpProjectGroup {
  projectPath: string;
  servers: McpServer[];
}

export interface McpResult {
  configPath: string;
  configExists: boolean;
  global: McpServer[];
  projects: McpProjectGroup[];
  totalCount: number;
}

function normalizeServer(name: string, raw: unknown, needsAuth: Set<string>): McpServer {
  const rec = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const url = typeof rec.url === "string" ? rec.url : null;
  let transport: McpServer["transport"] = "unknown";
  if (typeof rec.type === "string" && ["stdio", "sse", "http"].includes(rec.type)) {
    transport = rec.type as McpServer["transport"];
  } else if (typeof rec.command === "string") {
    transport = "stdio";
  } else if (url) {
    transport = "http";
  }
  const env = rec.env && typeof rec.env === "object" ? (rec.env as Record<string, unknown>) : {};
  return {
    name,
    transport,
    command: typeof rec.command === "string" ? rec.command : null,
    args: Array.isArray(rec.args) ? rec.args.map(String) : [],
    url,
    cwd: typeof rec.cwd === "string" ? rec.cwd : null,
    envKeys: Object.keys(env),
    needsAuth: needsAuth.has(name),
  };
}

function collectServers(
  raw: unknown,
  needsAuth: Set<string>
): McpServer[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, unknown>)
    .map(([name, def]) => normalizeServer(name, def, needsAuth))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function readAuthCache(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(safeResolve(AUTH_CACHE), "utf8");
    const data = JSON.parse(raw);
    if (data && typeof data === "object") return new Set(Object.keys(data));
  } catch {
    /* pas de cache : aucun serveur marqué */
  }
  return new Set();
}

export async function getMcpServers(): Promise<McpResult> {
  const needsAuth = await readAuthCache();

  let data: Record<string, unknown> | null = null;
  let configExists = false;
  try {
    const raw = await fs.readFile(CLAUDE_JSON, "utf8");
    configExists = true;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    /* fichier absent ou illisible */
  }

  const global = collectServers(data?.mcpServers, needsAuth);

  const projects: McpProjectGroup[] = [];
  const projRaw = data?.projects;
  if (projRaw && typeof projRaw === "object") {
    for (const [projectPath, val] of Object.entries(projRaw as Record<string, unknown>)) {
      const ms = val && typeof val === "object" ? (val as Record<string, unknown>).mcpServers : null;
      const servers = collectServers(ms, needsAuth);
      if (servers.length > 0) projects.push({ projectPath, servers });
    }
  }
  projects.sort((a, b) => a.projectPath.localeCompare(b.projectPath));

  const totalCount =
    global.length + projects.reduce((n, p) => n + p.servers.length, 0);

  return { configPath: CLAUDE_JSON, configExists, global, projects, totalCount };
}
