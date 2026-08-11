import fs from "fs/promises";
import path from "path";
import { CLAUDE_DIR, safeResolve } from "./claude";

/**
 * Lecture SEULE des plugins et marketplaces Claude Code.
 *
 * Les métadonnées vivent dans `~/.claude/plugins/` (DANS CLAUDE_DIR, via
 * safeResolve) :
 *   - `known_marketplaces.json`  : marketplaces connues (source + installLocation)
 *   - `installed_plugins.json`   : plugins installés (clé `nom@marketplace`)
 *   - `blocklist.json`           : plugins bloqués (avec raison)
 *
 * Le catalogue de chaque marketplace est lu à son `installLocation`, dans
 * `<installLocation>/.claude-plugin/marketplace.json`. Ce chemin provient d'un
 * fichier de config de confiance mais peut pointer HORS de CLAUDE_DIR (source
 * `directory`). C'est donc un accès lecture seule et ciblé, comme l'exception
 * documentée pour ~/.claude.json dans lib/mcp.ts.
 *
 * Les compteurs d'usage sont lus dans `~/.claude.json` (`pluginUsage`), hors
 * CLAUDE_DIR — lecture seule et ciblée elle aussi.
 */

const PLUGINS_DIR = "plugins";
const KNOWN_MARKETPLACES = "plugins/known_marketplaces.json";
const INSTALLED_PLUGINS = "plugins/installed_plugins.json";
const BLOCKLIST = "plugins/blocklist.json";

/** `~/.claude.json` — sibling de CLAUDE_DIR (respecte un override CLAUDE_DIR). */
const CLAUDE_JSON = path.join(path.dirname(CLAUDE_DIR), ".claude.json");

export interface MarketplacePluginEntry {
  name: string;
  description: string | null;
  author: string | null;
  category: string | null;
  homepage: string | null;
  sourceLabel: string | null;
  installed: boolean;
  blocked: boolean;
  blockReason: string | null;
}

export interface Marketplace {
  name: string;
  sourceType: string;
  sourceLabel: string;
  installLocation: string;
  lastUpdated: string | null;
  insideClaudeDir: boolean;
  catalogFound: boolean;
  description: string | null;
  owner: string | null;
  plugins: MarketplacePluginEntry[];
  installedCount: number;
}

export interface BlockedPlugin {
  plugin: string;
  reason: string | null;
  text: string | null;
  addedAt: string | null;
}

export interface PluginUsage {
  key: string;
  usageCount: number;
  lastUsedAt: number | null;
}

export interface PluginsResult {
  pluginsDir: string;
  configExists: boolean;
  marketplaces: Marketplace[];
  totalMarketplaces: number;
  totalAvailable: number;
  installedCount: number;
  blocked: BlockedPlugin[];
  usage: PluginUsage[];
}

async function readJson(absPath: string): Promise<unknown> {
  try {
    const raw = await fs.readFile(absPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Nom lisible d'un auteur (`{name,email}` ou chaîne). */
function authorLabel(v: unknown): string | null {
  if (typeof v === "string") return str(v);
  const rec = asRecord(v);
  return str(rec.name);
}

/** Résumé court d'une source de marketplace (`known_marketplaces.json`). */
function marketplaceSource(v: unknown): { type: string; label: string } {
  const rec = asRecord(v);
  const type = str(rec.source) ?? "unknown";
  if (type === "github") return { type, label: str(rec.repo) ?? "" };
  if (type === "directory") return { type, label: str(rec.path) ?? "" };
  return { type, label: str(rec.repo) ?? str(rec.path) ?? str(rec.url) ?? "" };
}

/** Résumé court de la source d'un plugin (dans un `marketplace.json`). */
function pluginSource(v: unknown): string | null {
  if (typeof v === "string") return v;
  const rec = asRecord(v);
  const type = str(rec.source);
  const loc = str(rec.url) ?? str(rec.path);
  if (type && loc) return `${type}: ${loc}`;
  return type ?? loc;
}

/** Clés `nom@marketplace` des plugins installés (format défensif). */
function installedKeys(v: unknown): Set<string> {
  const rec = asRecord(asRecord(v).plugins);
  return new Set(Object.keys(rec));
}

function parseBlocklist(v: unknown): BlockedPlugin[] {
  const list = asRecord(v).plugins;
  if (!Array.isArray(list)) return [];
  return list.map((entry) => {
    const rec = asRecord(entry);
    return {
      plugin: str(rec.plugin) ?? "?",
      reason: str(rec.reason),
      text: str(rec.text),
      addedAt: str(rec.added_at),
    };
  });
}

function parseUsage(v: unknown): PluginUsage[] {
  const rec = asRecord(v);
  return Object.entries(rec)
    .map(([key, val]) => {
      const r = asRecord(val);
      return {
        key,
        usageCount: typeof r.usageCount === "number" ? r.usageCount : 0,
        lastUsedAt: typeof r.lastUsedAt === "number" ? r.lastUsedAt : null,
      };
    })
    .sort((a, b) => b.usageCount - a.usageCount || a.key.localeCompare(b.key));
}

async function loadCatalog(
  marketplaceName: string,
  installLocation: string,
  installed: Set<string>,
  blockedByKey: Map<string, BlockedPlugin>
): Promise<{
  found: boolean;
  description: string | null;
  owner: string | null;
  plugins: MarketplacePluginEntry[];
}> {
  const manifest = await readJson(
    path.join(installLocation, ".claude-plugin", "marketplace.json")
  );
  if (!manifest) return { found: false, description: null, owner: null, plugins: [] };

  const rec = asRecord(manifest);
  const rawPlugins = Array.isArray(rec.plugins) ? rec.plugins : [];
  const plugins: MarketplacePluginEntry[] = rawPlugins.map((p) => {
    const pr = asRecord(p);
    const name = str(pr.name) ?? "?";
    const key = `${name}@${marketplaceName}`;
    const blocked = blockedByKey.get(key);
    return {
      name,
      description: str(pr.description),
      author: authorLabel(pr.author),
      category: str(pr.category),
      homepage: str(pr.homepage),
      sourceLabel: pluginSource(pr.source),
      installed: installed.has(key),
      blocked: Boolean(blocked),
      blockReason: blocked?.reason ?? null,
    };
  });
  plugins.sort((a, b) => a.name.localeCompare(b.name));

  return {
    found: true,
    description: str(rec.description),
    owner: authorLabel(rec.owner),
    plugins,
  };
}

export async function getPlugins(): Promise<PluginsResult> {
  const pluginsDir = safeResolve(PLUGINS_DIR);

  const [knownRaw, installedRaw, blocklistRaw, claudeJsonRaw] = await Promise.all([
    readJson(safeResolve(KNOWN_MARKETPLACES)),
    readJson(safeResolve(INSTALLED_PLUGINS)),
    readJson(safeResolve(BLOCKLIST)),
    readJson(CLAUDE_JSON),
  ]);

  const known = asRecord(knownRaw);
  const configExists = Object.keys(known).length > 0;
  const installed = installedKeys(installedRaw);
  const blocked = parseBlocklist(blocklistRaw);
  const blockedByKey = new Map(blocked.map((b) => [b.plugin, b]));
  const usage = parseUsage(asRecord(claudeJsonRaw).pluginUsage);

  const marketplaces: Marketplace[] = [];
  for (const [name, val] of Object.entries(known)) {
    const rec = asRecord(val);
    const { type, label } = marketplaceSource(rec.source);
    const installLocation = str(rec.installLocation) ?? "";
    const insideClaudeDir =
      installLocation !== "" &&
      !path.relative(CLAUDE_DIR, installLocation).startsWith("..");

    const catalog = installLocation
      ? await loadCatalog(name, installLocation, installed, blockedByKey)
      : { found: false, description: null, owner: null, plugins: [] };

    marketplaces.push({
      name,
      sourceType: type,
      sourceLabel: label,
      installLocation,
      lastUpdated: str(rec.lastUpdated),
      insideClaudeDir,
      catalogFound: catalog.found,
      description: catalog.description,
      owner: catalog.owner,
      plugins: catalog.plugins,
      installedCount: catalog.plugins.filter((p) => p.installed).length,
    });
  }
  marketplaces.sort((a, b) => a.name.localeCompare(b.name));

  const totalAvailable = marketplaces.reduce((n, m) => n + m.plugins.length, 0);

  return {
    pluginsDir,
    configExists,
    marketplaces,
    totalMarketplaces: marketplaces.length,
    totalAvailable,
    installedCount: installed.size,
    blocked,
    usage,
  };
}
