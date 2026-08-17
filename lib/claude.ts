import os from "os";
import path from "path";
import type { Language } from "@/lib/store";

/**
 * Racine de la configuration Claude Code. Surchargeable via CLAUDE_DIR pour les
 * tests ou une installation non standard.
 */
export const CLAUDE_DIR = process.env.CLAUDE_DIR || path.join(os.homedir(), ".claude");

/**
 * Résout un chemin en garantissant qu'il reste à l'intérieur de CLAUDE_DIR.
 * Empêche toute traversée de répertoire (`../`) venant d'un slug/id d'URL.
 */
export function safeResolve(...segments: string[]): string {
  const resolved = path.resolve(CLAUDE_DIR, ...segments);
  const rel = path.relative(CLAUDE_DIR, resolved);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    if (resolved !== CLAUDE_DIR) {
      throw new Error(`Chemin hors de CLAUDE_DIR: ${resolved}`);
    }
  }
  return resolved;
}

const bcp = (locale: Language) => (locale === "en" ? "en-US" : "fr-FR");

/** Formate un timestamp (ms) en date lisible selon la locale (défaut FR). */
export function formatDate(ms: number | string | undefined, locale: Language = "fr"): string {
  if (ms === undefined) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(bcp(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Durée lisible et compacte (ex. « 1 an 2 mois » / « 1 year 2 months »,
 * « 5 jours » / « 5 days », « 3 h »). Utilisée pour l'ancienneté d'un projet.
 */
export function formatDuration(ms: number, locale: Language = "fr"): string {
  if (ms < 0) ms = 0;
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const year = Math.floor(day / 365);
  const month = Math.floor((day % 365) / 30);
  const en = locale === "en";
  const s = (n: number) => (n > 1 ? "s" : "");
  if (year >= 1) {
    const y = en ? `${year} year${s(year)}` : `${year} an${s(year)}`;
    if (month < 1) return y;
    return en ? `${y} ${month} month${s(month)}` : `${y} ${month} mois`;
  }
  if (day >= 30) {
    const m = Math.floor(day / 30);
    return en ? `${m} month${s(m)}` : `${m} mois`;
  }
  if (day >= 1) return en ? `${day} day${s(day)}` : `${day} jour${s(day)}`;
  if (hr >= 1) return `${hr} h`;
  if (min >= 1) return `${min} min`;
  return en ? "just now" : "à l'instant";
}

/** Durée écoulée depuis un timestamp, préfixée « il y a » / suffixée « ago ». */
export function formatRelative(ms: number | undefined, locale: Language = "fr"): string {
  if (ms === undefined) return "—";
  const diff = Date.now() - ms;
  if (diff < 60000) return locale === "en" ? "just now" : "à l'instant";
  const d = formatDuration(diff, locale);
  return locale === "en" ? `${d} ago` : `il y a ${d}`;
}

/** Taille de fichier lisible (o/Ko/Mo en FR, B/KB/MB en EN). */
export function formatSize(bytes: number, locale: Language = "fr"): string {
  const u = locale === "en" ? ["B", "KB", "MB"] : ["o", "Ko", "Mo"];
  if (bytes < 1024) return `${bytes} ${u[0]}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${u[1]}`;
  return `${(bytes / 1024 / 1024).toFixed(1)} ${u[2]}`;
}
