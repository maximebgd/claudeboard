import fs from "fs/promises";
import type { Dirent } from "fs";
import { safeResolve } from "./claude";
import { listProjects, projectLabel } from "./projects";

const PROJECTS_DIR = "projects";

export type ModelFamily = "opus" | "sonnet" | "haiku" | "fable" | "autre";

export const MODEL_LABEL: Record<ModelFamily, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
  fable: "Fable",
  autre: "Autre",
};

export const MODEL_COLOR: Record<ModelFamily, string> = {
  opus: "#d97757",
  sonnet: "#5b9bd5",
  haiku: "#6bbf73",
  fable: "#a78bfa",
  autre: "#71717a",
};

const MODEL_ORDER: ModelFamily[] = ["opus", "sonnet", "haiku", "fable", "autre"];

/**
 * Tarifs indicatifs en USD par million de tokens (input / output / écriture cache /
 * lecture cache). Sert uniquement à une estimation locale du coût.
 */
const PRICING: Record<ModelFamily, { in: number; out: number; cacheWrite: number; cacheRead: number }> = {
  opus: { in: 15, out: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  sonnet: { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  haiku: { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  fable: { in: 15, out: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  autre: { in: 0, out: 0, cacheWrite: 0, cacheRead: 0 },
};

function modelFamily(model: string): ModelFamily {
  const m = model.toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  if (m.includes("fable")) return "fable";
  return "autre";
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function costUSD(fam: ModelFamily, inp: number, out: number, cr: number, cw: number): number {
  const p = PRICING[fam];
  return (inp * p.in + out * p.out + cr * p.cacheRead + cw * p.cacheWrite) / 1e6;
}

export interface ModelStat {
  family: ModelFamily;
  messages: number;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cacheWrite: number;
  costUSD: number;
}

export interface DayStat {
  date: string; // YYYY-MM-DD (UTC)
  sessions: number;
  messages: number;
  /** Nombre de messages assistant par famille de modèle, pour le % dans le tooltip. */
  models: Partial<Record<ModelFamily, number>>;
}

export interface Analytics {
  totals: {
    projects: number;
    sessions: number;
    messages: number;
    tokensIn: number;
    tokensOut: number;
    cacheRead: number;
    cacheWrite: number;
    costUSD: number;
    thinkingChars: number;
    textChars: number;
    toolUses: number;
  };
  models: ModelStat[];
  days: DayStat[];
  topTools: { name: string; count: number }[];
  session: {
    count: number;
    avgMessages: number;
    avgDurationMs: number;
    medianDurationMs: number;
  };
  recentProjects: { id: string; label: string; sessionCount: number; lastModified: number }[];
}

/**
 * Scanne tous les transcripts JSONL une seule fois et agrège les métriques du
 * dashboard : activité par jour, tokens/coût par modèle, top outils, durées de
 * session, ratio thinking/texte.
 */
export async function getAnalytics(): Promise<Analytics> {
  const dir = safeResolve(PROJECTS_DIR);
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    entries = [];
  }

  const models = new Map<ModelFamily, ModelStat>();
  const days = new Map<string, { sessions: Set<string>; messages: number; models: Map<ModelFamily, number> }>();
  const tools = new Map<string, number>();
  const durations: number[] = [];
  const msgCounts: number[] = [];

  let totalMessages = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let totalCost = 0;
  let thinkingChars = 0;
  let textChars = 0;
  let toolUses = 0;
  let sessionCount = 0;

  const modelStat = (f: ModelFamily): ModelStat => {
    let s = models.get(f);
    if (!s) {
      s = { family: f, messages: 0, tokensIn: 0, tokensOut: 0, cacheRead: 0, cacheWrite: 0, costUSD: 0 };
      models.set(f, s);
    }
    return s;
  };
  const dayStat = (d: string) => {
    let s = days.get(d);
    if (!s) {
      s = { sessions: new Set(), messages: 0, models: new Map() };
      days.set(d, s);
    }
    return s;
  };

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    let files: string[];
    try {
      files = (await fs.readdir(safeResolve(PROJECTS_DIR, e.name))).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const file of files) {
      const sessionId = file.replace(/\.jsonl$/, "");
      let raw: string;
      try {
        raw = await fs.readFile(safeResolve(PROJECTS_DIR, e.name, file), "utf8");
      } catch {
        continue;
      }
      sessionCount++;
      let first = Infinity;
      let last = -Infinity;
      let msgs = 0;

      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        let o: Record<string, unknown>;
        try {
          o = JSON.parse(line);
        } catch {
          continue;
        }
        const t = o.type;
        const tsStr = typeof o.timestamp === "string" ? o.timestamp : undefined;
        const ts = tsStr ? Date.parse(tsStr) : NaN;
        const day = tsStr ? tsStr.slice(0, 10) : null;

        if (t === "user" || t === "assistant") {
          totalMessages++;
          msgs++;
          if (!Number.isNaN(ts)) {
            first = Math.min(first, ts);
            last = Math.max(last, ts);
          }
          if (day) {
            const ds = dayStat(day);
            ds.messages++;
            ds.sessions.add(sessionId);
          }
        }

        if (t === "assistant") {
          const m = (o.message ?? {}) as Record<string, unknown>;
          const fam = modelFamily(String(m.model ?? ""));
          const content = Array.isArray(m.content) ? m.content : [];
          for (const b of content) {
            if (!b || typeof b !== "object") continue;
            const rec = b as Record<string, unknown>;
            if (rec.type === "text") textChars += String(rec.text ?? "").length;
            else if (rec.type === "thinking") thinkingChars += String(rec.thinking ?? rec.text ?? "").length;
            else if (rec.type === "tool_use") {
              toolUses++;
              const name = String(rec.name ?? "tool");
              tools.set(name, (tools.get(name) ?? 0) + 1);
            }
          }
          const u = (m.usage ?? {}) as Record<string, unknown>;
          const inp = num(u.input_tokens);
          const out = num(u.output_tokens);
          const cr = num(u.cache_read_input_tokens);
          const cw = num(u.cache_creation_input_tokens);
          const st = modelStat(fam);
          st.messages++;
          st.tokensIn += inp;
          st.tokensOut += out;
          st.cacheRead += cr;
          st.cacheWrite += cw;
          const c = costUSD(fam, inp, out, cr, cw);
          st.costUSD += c;
          totalCost += c;
          tokensIn += inp;
          tokensOut += out;
          cacheRead += cr;
          cacheWrite += cw;
          if (day) {
            const ds = dayStat(day);
            ds.models.set(fam, (ds.models.get(fam) ?? 0) + 1);
          }
        }
      }

      if (msgs > 0) {
        msgCounts.push(msgs);
        if (first !== Infinity && last > first) durations.push(last - first);
      }
    }
  }

  const projects = await listProjects();
  const recentProjects = projects.slice(0, 6).map((p) => ({
    id: p.id,
    label: projectLabel(p.realPath),
    sessionCount: p.sessionCount,
    lastModified: p.lastModified,
  }));

  const daysArr: DayStat[] = [...days.entries()]
    .map(([date, v]) => ({
      date,
      sessions: v.sessions.size,
      messages: v.messages,
      models: Object.fromEntries(v.models) as Partial<Record<ModelFamily, number>>,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const sortedDur = [...durations].sort((a, b) => a - b);
  const median = sortedDur.length ? sortedDur[Math.floor(sortedDur.length / 2)] : 0;
  const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const avgMsg = msgCounts.length ? msgCounts.reduce((a, b) => a + b, 0) / msgCounts.length : 0;

  const modelsArr = [...models.values()].sort(
    (a, b) => MODEL_ORDER.indexOf(a.family) - MODEL_ORDER.indexOf(b.family),
  );

  const topTools = [...tools.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    totals: {
      projects: projects.length,
      sessions: sessionCount,
      messages: totalMessages,
      tokensIn,
      tokensOut,
      cacheRead,
      cacheWrite,
      costUSD: totalCost,
      thinkingChars,
      textChars,
      toolUses,
    },
    models: modelsArr,
    days: daysArr,
    topTools,
    session: {
      count: sessionCount,
      avgMessages: avgMsg,
      avgDurationMs: avgDur,
      medianDurationMs: median,
    },
    recentProjects,
  };
}
