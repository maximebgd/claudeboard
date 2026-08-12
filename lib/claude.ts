import os from "os";
import path from "path";

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

/** Formate un timestamp (ms) en date lisible FR. */
export function formatDate(ms: number | string | undefined): string {
  if (ms === undefined) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Durée lisible et compacte en français (ex. « 1 an 2 mois », « 5 jours »,
 * « 3 h »). Utilisée pour l'ancienneté d'un projet.
 */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const year = Math.floor(day / 365);
  const month = Math.floor((day % 365) / 30);
  if (year >= 1) {
    return month >= 1
      ? `${year} an${year > 1 ? "s" : ""} ${month} mois`
      : `${year} an${year > 1 ? "s" : ""}`;
  }
  if (day >= 30) return `${Math.floor(day / 30)} mois`;
  if (day >= 1) return `${day} jour${day > 1 ? "s" : ""}`;
  if (hr >= 1) return `${hr} h`;
  if (min >= 1) return `${min} min`;
  return "à l'instant";
}

/** Durée écoulée depuis un timestamp, préfixée « il y a ». */
export function formatRelative(ms: number | undefined): string {
  if (ms === undefined) return "—";
  const diff = Date.now() - ms;
  if (diff < 60000) return "à l'instant";
  return `il y a ${formatDuration(diff)}`;
}

/** Taille de fichier lisible. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
