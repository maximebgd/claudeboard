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

/** Au-delà de ce seuil sans nouveau message, on considère une pause (non comptée). */
const IDLE_GAP_MS = 30 * 60 * 1000;

/** Durée d'un jour en ms — sert au calcul des séries de jours consécutifs (streak). */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Numéro de jour (UTC) depuis l'époque, pour une clé `YYYY-MM-DD`. */
function dayNumber(dayKey: string): number {
  return Math.floor(Date.parse(dayKey + "T00:00:00Z") / DAY_MS);
}

/**
 * Calcule la série de jours consécutifs d'utilisation à partir de l'ensemble des jours
 * actifs (clés `YYYY-MM-DD` UTC, comme la heatmap). `current` n'est comptée que si le
 * dernier jour actif est aujourd'hui ou hier (UTC) — sinon la série est rompue (0).
 */
function computeStreak(dayKeys: string[]): StreakStat {
  const empty: StreakStat = {
    current: 0,
    longest: 0,
    longestStart: "",
    longestEnd: "",
    lastActiveDate: "",
    activeToday: false,
  };
  if (dayKeys.length === 0) return empty;

  const keys = [...dayKeys].sort(); // YYYY-MM-DD trié = ordre chronologique
  const nums = keys.map(dayNumber);

  let longest = 1;
  let bestStart = 0;
  let bestEnd = 0;
  let runStart = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) {
      if (i - runStart + 1 > longest) {
        longest = i - runStart + 1;
        bestStart = runStart;
        bestEnd = i;
      }
    } else {
      runStart = i;
    }
  }

  const todayNum = Math.floor(Date.now() / DAY_MS);
  const lastNum = nums[nums.length - 1];
  const activeToday = lastNum === todayNum;
  let current = 0;
  if (lastNum === todayNum || lastNum === todayNum - 1) {
    current = 1;
    for (let i = nums.length - 1; i > 0; i--) {
      if (nums[i] === nums[i - 1] + 1) current++;
      else break;
    }
  }

  return {
    current,
    longest,
    longestStart: keys[bestStart],
    longestEnd: keys[bestEnd],
    lastActiveDate: keys[keys.length - 1],
    activeToday,
  };
}

/**
 * Temps « actif » d'une session : somme des écarts entre messages consécutifs, en
 * ignorant tout trou d'inactivité supérieur à IDLE_GAP_MS. Évite qu'une session
 * laissée ouverte (long silence puis reprise) gonfle la durée avec son écart brut
 * début→fin.
 */
function activeDuration(times: number[]): number {
  if (times.length < 2) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > 0 && gap <= IDLE_GAP_MS) total += gap;
  }
  return total;
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

/**
 * Série de jours consécutifs d'utilisation (streak), calculée sur l'historique complet
 * des jours actifs (indépendante de la fenêtre, comme la heatmap).
 */
export interface StreakStat {
  /** Jours consécutifs jusqu'à aujourd'hui (ou hier) ; 0 si la série est rompue. */
  current: number;
  /** Meilleure série historique. */
  longest: number;
  /** Bornes de la meilleure série (`YYYY-MM-DD` UTC ; `""` si aucun jour actif). */
  longestStart: string;
  longestEnd: string;
  /** Dernier jour actif (`YYYY-MM-DD` UTC). */
  lastActiveDate: string;
  /** `true` si le dernier jour actif est aujourd'hui (série encore « vivante »). */
  activeToday: boolean;
}

/** Totaux d'une période, pour comparer N vs N-1 (vélocité / tendance). */
export interface TrendTotals {
  messages: number;
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  sessions: number;
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
  /** Série de jours consécutifs d'utilisation (historique complet, hors fenêtre). */
  streak: StreakStat;
  topTools: { name: string; count: number }[];
  session: {
    count: number;
    avgMessages: number;
    avgDurationMs: number;
    medianDurationMs: number;
    /** Somme du temps actif des sessions sur la fenêtre (gaps > 30 min ignorés). */
    totalDurationMs: number;
  };
  recentProjects: { id: string; label: string; sessionCount: number; createdAt: number; lastModified: number; costUSD: number }[];
  /** Coût estimé (USD) agrégé par projet sur la fenêtre, trié décroissant. */
  projectCosts: { id: string; label: string; costUSD: number }[];
  /**
   * Totaux de la période **précédente** (`[prevSinceMs, prevUntilMs]`), agrégés dans
   * le même passage pour calculer la vélocité (N vs N-1). `null` si aucune période de
   * comparaison n'est demandée (fenêtre « Tout » ou bornes précédentes non fournies).
   */
  trend: TrendTotals | null;
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
 *
 * `prevSinceMs` / `prevUntilMs` (optionnels) décrivent la période **précédente** à
 * comparer (N-1) : ses totaux sont accumulés dans le même passage et renvoyés dans
 * `trend`. Les deux bornes doivent être posées (> 0) pour activer la comparaison.
 */
export async function getAnalytics(
  sinceMs = 0,
  untilMs = 0,
  prevSinceMs = 0,
  prevUntilMs = 0,
): Promise<Analytics> {
  const hasBound = sinceMs > 0 || untilMs > 0;
  const hasPrev = prevSinceMs > 0 && prevUntilMs > 0;
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

  // Totaux de la période précédente (N-1), accumulés dans le même passage.
  let prevMessages = 0;
  let prevTokensIn = 0;
  let prevTokensOut = 0;
  let prevCost = 0;
  let prevSessions = 0;

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
      let msgs = 0;
      // Messages de cette session tombant dans la période précédente (N-1).
      let prevMsgs = 0;
      // Timestamps (in-range) de la session, pour calculer le temps actif ci-dessous.
      const times: number[] = [];
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

        // Période précédente (N-1) : accumulée en parallèle de la fenêtre courante,
        // pour la vélocité. Se calcule avant le filtre `inRange` (les deux fenêtres
        // sont par construction disjointes).
        if (hasPrev && !Number.isNaN(ts) && ts >= prevSinceMs && ts <= prevUntilMs) {
          prevMessages++;
          prevMsgs++;
          if (t === "assistant") {
            const u = (m.usage ?? {}) as Record<string, unknown>;
            const inp = num(u.input_tokens);
            const out = num(u.output_tokens);
            prevTokensIn += inp;
            prevTokensOut += out;
            prevCost += costUSD(
              parseModel(rawModel).family,
              inp,
              out,
              num(u.cache_read_input_tokens),
              num(u.cache_creation_input_tokens),
            );
          }
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
          times.push(ts);
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
        const active = activeDuration(times);
        if (active > 0) durations.push(active);
      }
      if (prevMsgs > 0) prevSessions++;
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

  // Streak : basé sur toutes les clés de jour (historique complet, comme la heatmap).
  const streak = computeStreak([...days.keys()]);

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
  const totalDur = durations.reduce((a, b) => a + b, 0);
  const avgDur = durations.length ? totalDur / durations.length : 0;
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
    streak,
    topTools,
    session: {
      count: sessionCount,
      avgMessages: avgMsg,
      avgDurationMs: avgDur,
      medianDurationMs: median,
      totalDurationMs: totalDur,
    },
    recentProjects,
    projectCosts,
    trend: hasPrev
      ? {
          messages: prevMessages,
          tokensIn: prevTokensIn,
          tokensOut: prevTokensOut,
          costUSD: prevCost,
          sessions: prevSessions,
        }
      : null,
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
  /** Temps actif total passé sur le projet (gaps > 30 min ignorés). */
  totalDurationMs: number;
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
  let totalDurationMs = 0;

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
    // Timestamps de la session, pour sommer son temps actif (même logique que getAnalytics).
    const times: number[] = [];

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
        times.push(ts);
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

    if (msgs > 0) {
      sessions++;
      totalDurationMs += activeDuration(times);
    }
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
    totalDurationMs,
  };
}
