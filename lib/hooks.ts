import { readConfigFile } from "./configFiles";

/**
 * Lecture normalisée des hooks configurés dans settings.json et
 * settings.local.json. Structure attendue dans les settings :
 *
 *   "hooks": {
 *     "<Event>": [ { "matcher": "Bash", "hooks": [ { "type": "command",
 *                     "command": "...", "timeout": 30 } ] } ]
 *   }
 *
 * Les données sont contrôlées par l'utilisateur : on parse défensivement.
 */

/** Ordre d'affichage habituel des events de hooks Claude Code. */
const EVENT_ORDER = [
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "Notification",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "SessionStart",
  "SessionEnd",
];

export type HookSource = "settings.json" | "settings.local.json";

export interface HookCommand {
  type: string; // "command" en pratique
  command: string | null;
  timeout: number | null;
}

export interface HookMatcher {
  matcher: string | null; // ex. "Bash", "Edit|Write", "*" ou null
  hooks: HookCommand[];
  source: HookSource;
}

export interface HookEvent {
  event: string;
  matchers: HookMatcher[];
}

function parseCommands(raw: unknown): HookCommand[] {
  if (!Array.isArray(raw)) return [];
  const out: HookCommand[] = [];
  for (const h of raw) {
    if (!h || typeof h !== "object") continue;
    const rec = h as Record<string, unknown>;
    out.push({
      type: typeof rec.type === "string" ? rec.type : "command",
      command: typeof rec.command === "string" ? rec.command : null,
      timeout: typeof rec.timeout === "number" ? rec.timeout : null,
    });
  }
  return out;
}

function parseEventMatchers(raw: unknown, source: HookSource): HookMatcher[] {
  if (!Array.isArray(raw)) return [];
  const out: HookMatcher[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const rec = m as Record<string, unknown>;
    out.push({
      matcher: typeof rec.matcher === "string" ? rec.matcher : null,
      hooks: parseCommands(rec.hooks),
      source,
    });
  }
  return out;
}

export interface HooksResult {
  events: HookEvent[];
  totalHooks: number;
  sources: { file: HookSource; path: string; hasHooks: boolean }[];
}

export async function getHooks(): Promise<HooksResult> {
  const [user, local] = await Promise.all([
    readConfigFile("settings"),
    readConfigFile("settingsLocal"),
  ]);

  // Agrège event → matchers, en fusionnant les deux sources.
  const byEvent = new Map<string, HookMatcher[]>();
  for (const { file, source } of [
    { file: user, source: "settings.json" as HookSource },
    { file: local, source: "settings.local.json" as HookSource },
  ]) {
    const hooks = file.data?.hooks;
    if (!hooks || typeof hooks !== "object") continue;
    for (const [event, val] of Object.entries(hooks as Record<string, unknown>)) {
      const matchers = parseEventMatchers(val, source);
      if (matchers.length === 0) continue;
      byEvent.set(event, [...(byEvent.get(event) || []), ...matchers]);
    }
  }

  const events: HookEvent[] = [...byEvent.entries()]
    .map(([event, matchers]) => ({ event, matchers }))
    .sort((a, b) => {
      const ia = EVENT_ORDER.indexOf(a.event);
      const ib = EVENT_ORDER.indexOf(b.event);
      if (ia === -1 && ib === -1) return a.event.localeCompare(b.event);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

  const totalHooks = events.reduce(
    (n, e) => n + e.matchers.reduce((m, mm) => m + mm.hooks.length, 0),
    0
  );

  return {
    events,
    totalHooks,
    sources: [
      { file: "settings.json", path: user.path, hasHooks: !!user.data?.hooks },
      { file: "settings.local.json", path: local.path, hasHooks: !!local.data?.hooks },
    ],
  };
}
