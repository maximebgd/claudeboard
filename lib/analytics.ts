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
 * lecture cache). La lecture cache utilise 0,1× input. Sert uniquement à une
 * estimation locale du coût.
 */
export const PRICING: Record<ModelFamily, { in: number; out: number; cacheWrite: number; cacheRead: number }> = {
  opus: { in: 5, out: 25, cacheWrite: 10, cacheRead: 0.5 },
  sonnet: { in: 3, out: 15, cacheWrite: 6, cacheRead: 0.3 },
  haiku: { in: 1, out: 5, cacheWrite: 2, cacheRead: 0.1 },
  fable: { in: 10, out: 50, cacheWrite: 20, cacheRead: 1.0 },
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

/**
 * Dérive un libellé lisible et la famille depuis un id de modèle brut.
 * Ex. `claude-opus-4-8` → { family: "opus", label: "Opus 4.8" }.
 */
export function parseModel(id: string): { family: ModelFamily; label: string } {
  const family = modelFamily(id);
  if (family === "autre") {
    return { family, label: !id || id === "<synthetic>" ? "Synthétique" : id };
  }
  // Ne garde que les segments numériques de version (ignore les suffixes de date).
  const nums = id
    .toLowerCase()
    .replace(/^claude-/, "")
    .split("-")
    .filter((p) => /^\d+$/.test(p) && p.length < 6)
    .slice(0, 2);
  return { family, label: nums.length ? `${MODEL_LABEL[family]} ${nums.join(".")}` : MODEL_LABEL[family] };
}

/** Éclaircit une couleur hex vers le blanc (t ∈ [0,1]) pour nuancer les versions. */
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Récupère (ou crée) la ligne de stat d'un modèle dans la map partagée. */
function ensureModelStat(models: Map<string, ModelStat>, id: string): ModelStat {
  let s = models.get(id);
  if (!s) {
    const { family, label } = parseModel(id);
    s = {
      key: id,
      label,
      family,
      color: MODEL_COLOR[family],
      messages: 0,
      messagesIn: 0,
      tokensIn: 0,
      tokensOut: 0,
      cacheRead: 0,
      cacheWrite: 0,
      costUSD: 0,
    };
    models.set(id, s);
  }
  return s;
}

/**
 * Applique la teinte par version (récent = couleur de base, ancien éclairci) puis
 * renvoie les modèles filtrés (masque les « Synthétiques » à coût nul) et triés
 * pour l'affichage.
 */
function finalizeModels(models: Map<string, ModelStat>): ModelStat[] {
  const byFamily = new Map<ModelFamily, ModelStat[]>();
  for (const s of models.values()) {
    const list = byFamily.get(s.family) ?? [];
    list.push(s);
    byFamily.set(s.family, list);
  }
  for (const list of byFamily.values()) {
    list.sort((a, b) => b.key.localeCompare(a.key)); // plus récent d'abord
    list.forEach((s, i) => {
      s.color = i === 0 ? MODEL_COLOR[s.family] : lighten(MODEL_COLOR[s.family], Math.min(0.55, i * 0.26));
    });
  }
  return [...models.values()]
    // Masque les messages « Synthétiques » (générés localement, sans appel modèle)
    // uniquement quand leur coût est nul ; s'ils ont un coût réel, on les garde.
    .filter((m) => {
      const synthetic = m.key === "" || m.key === "<synthetic>";
      return !(synthetic && Math.round(m.costUSD * 100) === 0);
    })
    .sort((a, b) => {
      const fam = MODEL_ORDER.indexOf(a.family) - MODEL_ORDER.indexOf(b.family);
      return fam !== 0 ? fam : b.messages - a.messages;
    });
}

export interface ModelStat {
  key: string; // id de modèle brut (ex. claude-opus-4-8)
  label: string; // libellé lisible (ex. Opus 4.8)
  family: ModelFamily;
  color: string; // teinte d'affichage (base famille, nuancée par version)
  messages: number; // réponses de l'assistant pour ce modèle (messages OUT)
  messagesIn: number; // messages utilisateur ayant précédé une réponse de ce modèle (IN)
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
  /** Nombre de messages assistant par id de modèle, pour le % dans le tooltip. */
  models: Record<string, number>;
  /** Coût estimé (USD) du jour — historique complet, indépendant de la fenêtre. */
  costUSD: number;
}

export interface Analytics {
  totals: {
    projects: number;
    sessions: number;
    messages: number;
    /** Messages envoyés (lignes de type `user`, résultats d'outils inclus). */
    userMessages: number;
    /** Messages reçus (lignes de type `assistant`). */
    assistantMessages: number;
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
  /** Débuts de session par heure locale (index 0–23) sur la fenêtre. */
  hours: number[];
  topTools: { name: string; count: number }[];
  session: {
    count: number;
    avgMessages: number;
    avgDurationMs: number;
    medianDurationMs: number;
  };
  recentProjects: { id: string; label: string; sessionCount: number; createdAt: number; lastModified: number; costUSD: number }[];
  /** Coût estimé (USD) agrégé par projet sur la fenêtre, trié décroissant. */
  projectCosts: { id: string; label: string; costUSD: number }[];
}

/**
 * Scanne tous les transcripts JSONL une seule fois et agrège les métriques du
 * dashboard : activité par jour, tokens/coût par modèle, top outils, durées de
 * session, ratio thinking/texte.
 *
 * `sinceMs` / `untilMs` (optionnels) restreignent l'agrégation aux messages dont le
 * timestamp tombe dans la fenêtre `[sinceMs, untilMs]` (ms epoch, bornes incluses).
 * Dès qu'une borne est posée, les lignes sans timestamp sont ignorées. `0` sur une
 * borne = pas de limite de ce côté (donc `0, 0` = tout l'historique).
 */
export async function getAnalytics(sinceMs = 0, untilMs = 0): Promise<Analytics> {
  const hasBound = sinceMs > 0 || untilMs > 0;
  const dir = safeResolve(PROJECTS_DIR);
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    entries = [];
  }

  const models = new Map<string, ModelStat>();
  const days = new Map<
    string,
    { sessions: Set<string>; messages: number; models: Map<string, number>; costUSD: number }
  >();
  const tools = new Map<string, number>();
  // Coût estimé (USD) accumulé par dossier de projet (clé = e.name), fenêtre incluse.
  const projCost = new Map<string, number>();
  const durations: number[] = [];
  const msgCounts: number[] = [];
  // Débuts de session par heure locale (0–23) : incrémenté au 1er message daté de
  // chaque session tombant dans la fenêtre.
  const hourBuckets = new Array<number>(24).fill(0);

  let totalMessages = 0;
  let userMessages = 0;
  let assistantMessages = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let totalCost = 0;
  let thinkingChars = 0;
  let textChars = 0;
  let toolUses = 0;
  let sessionCount = 0;

  const modelStat = (id: string): ModelStat => ensureModelStat(models, id);
  const dayStat = (d: string) => {
    let s = days.get(d);
    if (!s) {
      s = { sessions: new Set(), messages: 0, models: new Map(), costUSD: 0 };
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
      let first = Infinity;
      let last = -Infinity;
      let msgs = 0;
      // Messages utilisateur en attente d'attribution : ils comptent comme « IN »
      // du prochain modèle qui répond (dans le même transcript).
      let pendingUsers = 0;

      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        let o: Record<string, unknown>;
        try {
          o = JSON.parse(line);
        } catch {
          continue;
        }
        const t = o.type;
        if (t !== "user" && t !== "assistant") continue;
        const tsStr = typeof o.timestamp === "string" ? o.timestamp : undefined;
        const ts = tsStr ? Date.parse(tsStr) : NaN;
        const day = tsStr ? tsStr.slice(0, 10) : null;
        const inRange =
          !hasBound ||
          (!Number.isNaN(ts) && ts >= sinceMs && (untilMs === 0 || ts <= untilMs));

        // Activité quotidienne (heatmap) : TOUJOURS agrégée, indépendante de la
        // fenêtre — la heatmap montre l'historique complet quel que soit le filtre.
        if (day) {
          const ds = dayStat(day);
          ds.messages++;
          ds.sessions.add(sessionId);
        }

        const m = (o.message ?? {}) as Record<string, unknown>;
        const rawModel = t === "assistant" ? String(m.model ?? "") : "";
        if (t === "assistant" && day) {
          const ds = dayStat(day);
          ds.models.set(rawModel, (ds.models.get(rawModel) ?? 0) + 1);
          // Coût du jour : agrégé sur tout l'historique (comme la heatmap), donc
          // calculé ici avant le filtre de fenêtre.
          const u = (m.usage ?? {}) as Record<string, unknown>;
          ds.costUSD += costUSD(
            parseModel(rawModel).family,
            num(u.input_tokens),
            num(u.output_tokens),
            num(u.cache_read_input_tokens),
            num(u.cache_creation_input_tokens),
          );
        }

        // À partir d'ici : statistiques filtrées par la fenêtre sélectionnée.
        if (!inRange) continue;

        totalMessages++;
        if (t === "user") {
          userMessages++;
          pendingUsers++;
        } else assistantMessages++;
        msgs++;
        if (!Number.isNaN(ts)) {
          first = Math.min(first, ts);
          last = Math.max(last, ts);
        }

        if (t === "assistant") {
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
          const st = modelStat(rawModel);
          st.messages++;
          st.messagesIn += pendingUsers;
          pendingUsers = 0;
          st.tokensIn += inp;
          st.tokensOut += out;
          st.cacheRead += cr;
          st.cacheWrite += cw;
          const c = costUSD(st.family, inp, out, cr, cw);
          st.costUSD += c;
          totalCost += c;
          projCost.set(e.name, (projCost.get(e.name) ?? 0) + c);
          tokensIn += inp;
          tokensOut += out;
          cacheRead += cr;
          cacheWrite += cw;
        }
      }

      if (msgs > 0) {
        sessionCount++;
        msgCounts.push(msgs);
        if (first !== Infinity) hourBuckets[new Date(first).getHours()]++;
        if (first !== Infinity && last > first) durations.push(last - first);
      }
    }
  }

  const allProjects = await listProjects();
  const projects = hasBound
    ? allProjects.filter((p) => p.lastModified >= sinceMs && (untilMs === 0 || p.lastModified <= untilMs))
    : allProjects;
  const recentProjects = projects.map((p) => ({
    id: p.id,
    label: projectLabel(p.realPath),
    sessionCount: p.sessionCount,
    createdAt: p.createdAt,
    lastModified: p.lastModified,
    costUSD: projCost.get(p.id) ?? 0,
  }));

  const projectCosts = projects
    .map((p) => ({ id: p.id, label: projectLabel(p.realPath), costUSD: projCost.get(p.id) ?? 0 }))
    .sort((a, b) => b.costUSD - a.costUSD);

  const daysArr: DayStat[] = [...days.entries()]
    .map(([date, v]) => ({
      date,
      sessions: v.sessions.size,
      messages: v.messages,
      models: Object.fromEntries(v.models),
      costUSD: v.costUSD,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const sortedDur = [...durations].sort((a, b) => a - b);
  const median = sortedDur.length ? sortedDur[Math.floor(sortedDur.length / 2)] : 0;
  const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const avgMsg = msgCounts.length ? msgCounts.reduce((a, b) => a + b, 0) / msgCounts.length : 0;

  const modelsArr = finalizeModels(models);

  const topTools = [...tools.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    totals: {
      projects: projects.length,
      sessions: sessionCount,
      messages: totalMessages,
      userMessages,
      assistantMessages,
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
    hours: hourBuckets,
    topTools,
    session: {
      count: sessionCount,
      avgMessages: avgMsg,
      avgDurationMs: avgDur,
      medianDurationMs: median,
    },
    recentProjects,
    projectCosts,
  };
}

export interface ProjectStats {
  totals: {
    sessions: number;
    messages: number;
    userMessages: number;
    assistantMessages: number;
    tokensIn: number;
    tokensOut: number;
    cacheRead: number;
    cacheWrite: number;
    costUSD: number;
    toolUses: number;
  };
  models: ModelStat[];
  topTools: { name: string; count: number }[];
  /** Bornes d'activité (ms epoch) ; `0` si aucun message daté. */
  firstActivity: number;
  lastActivity: number;
}

/**
 * Statistiques d'un **seul** projet : scanne uniquement son dossier (pas tout le
 * FS comme `getAnalytics`) et agrège modèles, tokens, coût estimé et top outils.
 */
export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  const models = new Map<string, ModelStat>();
  const tools = new Map<string, number>();

  let files: string[] = [];
  try {
    files = (await fs.readdir(safeResolve(PROJECTS_DIR, projectId))).filter((f) => f.endsWith(".jsonl"));
  } catch {
    files = [];
  }

  let sessions = 0;
  let messages = 0;
  let userMessages = 0;
  let assistantMessages = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let totalCost = 0;
  let toolUses = 0;
  let firstActivity = Infinity;
  let lastActivity = -Infinity;

  for (const file of files) {
    let raw: string;
    try {
      raw = await fs.readFile(safeResolve(PROJECTS_DIR, projectId, file), "utf8");
    } catch {
      continue;
    }
    let msgs = 0;
    // Messages utilisateur en attente : comptés comme « IN » du prochain modèle qui répond.
    let pendingUsers = 0;

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      let o: Record<string, unknown>;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      const t = o.type;
      if (t !== "user" && t !== "assistant") continue;

      const ts = typeof o.timestamp === "string" ? Date.parse(o.timestamp) : NaN;
      if (!Number.isNaN(ts)) {
        firstActivity = Math.min(firstActivity, ts);
        lastActivity = Math.max(lastActivity, ts);
      }

      messages++;
      msgs++;
      if (t === "user") {
        userMessages++;
        pendingUsers++;
        continue;
      }
      assistantMessages++;

      const m = (o.message ?? {}) as Record<string, unknown>;
      const content = Array.isArray(m.content) ? m.content : [];
      for (const b of content) {
        if (!b || typeof b !== "object") continue;
        const rec = b as Record<string, unknown>;
        if (rec.type === "tool_use") {
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
      const st = ensureModelStat(models, String(m.model ?? ""));
      st.messages++;
      st.messagesIn += pendingUsers;
      pendingUsers = 0;
      st.tokensIn += inp;
      st.tokensOut += out;
      st.cacheRead += cr;
      st.cacheWrite += cw;
      const c = costUSD(st.family, inp, out, cr, cw);
      st.costUSD += c;
      totalCost += c;
      tokensIn += inp;
      tokensOut += out;
      cacheRead += cr;
      cacheWrite += cw;
    }

    if (msgs > 0) sessions++;
  }

  const topTools = [...tools.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    totals: {
      sessions,
      messages,
      userMessages,
      assistantMessages,
      tokensIn,
      tokensOut,
      cacheRead,
      cacheWrite,
      costUSD: totalCost,
      toolUses,
    },
    models: finalizeModels(models),
    topTools,
    firstActivity: firstActivity === Infinity ? 0 : firstActivity,
    lastActivity: lastActivity === -Infinity ? 0 : lastActivity,
  };
}
