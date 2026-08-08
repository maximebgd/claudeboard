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

/** Taille de fichier lisible. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
