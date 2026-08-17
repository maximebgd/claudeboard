import fs from "fs/promises";
import { safeResolve } from "./claude";
import { moveToTrash } from "./trash";
import { saveBackup } from "./backups";
import { translate, type Language } from "./i18n/core";
import type { PermissionResource } from "./store";

/**
 * Fichiers de configuration « uniques » de ~/.claude (par opposition aux
 * dossiers d'entrées comme skills/agents/commands). Chaque cible connaît son
 * nom de fichier, son format et un libellé lisible. Tout reste dans CLAUDE_DIR
 * (garde `safeResolve`).
 */
export type ConfigTarget = "settings" | "settingsLocal" | "claudeMd" | "keybindings";

interface TargetDef {
  file: string;
  format: "json" | "markdown";
  label: string;
}

const TARGETS: Record<ConfigTarget, TargetDef> = {
  settings: { file: "settings.json", format: "json", label: "settings.json" },
  settingsLocal: { file: "settings.local.json", format: "json", label: "settings.local.json" },
  claudeMd: { file: "CLAUDE.md", format: "markdown", label: "CLAUDE.md (global)" },
  keybindings: { file: "keybindings.json", format: "json", label: "keybindings.json" },
};

export function isConfigTarget(v: unknown): v is ConfigTarget {
  return typeof v === "string" && v in TARGETS;
}

/** Ressource de permission correspondant à une cible de config. */
export function configResource(target: ConfigTarget): PermissionResource {
  if (target === "settings" || target === "settingsLocal") return "settings";
  return target === "claudeMd" ? "claudeMd" : "keybindings";
}

export interface ConfigFile {
  target: ConfigTarget;
  file: string;
  path: string;
  format: "json" | "markdown";
  label: string;
  exists: boolean;
  raw: string; // "" si le fichier n'existe pas
  /** Objet parsé pour les cibles JSON (null si absent ou JSON invalide). */
  data: Record<string, unknown> | null;
  updatedAt: number | null;
}

export async function readConfigFile(target: ConfigTarget): Promise<ConfigFile> {
  const def = TARGETS[target];
  const filePath = safeResolve(def.file);
  const base: Omit<ConfigFile, "exists" | "raw" | "data" | "updatedAt"> = {
    target,
    file: def.file,
    path: filePath,
    format: def.format,
    label: def.label,
  };
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const st = await fs.stat(filePath);
    let data: Record<string, unknown> | null = null;
    if (def.format === "json") {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
      } catch {
        data = null; // JSON cassé : on renvoie quand même le raw pour édition/correction
      }
    }
    return { ...base, exists: true, raw, data, updatedAt: st.mtimeMs };
  } catch {
    return { ...base, exists: false, raw: "", data: null, updatedAt: null };
  }
}

/**
 * Écrit une cible de config. Les cibles JSON sont validées (JSON.parse) avant
 * écriture. Si le fichier existait déjà, sa version précédente est archivée dans
 * l'historique de versions (`data/backups/`, **hors** de ~/.claude — cf. `backups.ts`),
 * restaurable depuis le panneau « Versions » de l'éditeur. Les créations
 * (settings.local.json, keybindings.json, CLAUDE.md global) sont explicites côté UI.
 * Retourne le chemin de la version archivée, ou null si création.
 */
export async function writeConfigFile(target: ConfigTarget, raw: string): Promise<string | null> {
  const def = TARGETS[target];
  if (def.format === "json") {
    JSON.parse(raw); // lève si invalide → l'appelant renvoie une 400
  }
  const filePath = safeResolve(def.file);
  let backupPath: string | null = null;
  try {
    const prev = await fs.readFile(filePath, "utf8");
    backupPath = await saveBackup(target, prev);
  } catch {
    // le fichier n'existe pas encore : création explicite, pas d'archivage
  }
  await fs.writeFile(filePath, raw, "utf8");
  return backupPath;
}

/**
 * Contenu « par défaut » restauré par une réinitialisation, selon la cible. Le
 * CLAUDE.md global (markdown) est traduit dans la langue de l'UI ; les cibles JSON
 * sont structurelles (non traduites).
 */
function resetTemplate(target: ConfigTarget, locale: Language): string {
  switch (target) {
    case "settings":
    case "settingsLocal":
      return `{\n\n}\n`;
    case "keybindings":
      return `{\n  "keybindings": []\n}\n`;
    case "claudeMd":
      return `# ${translate(locale, "claudeMd.template.title")}\n\n`;
  }
}

/**
 * Réinitialise une cible à son contenu par défaut (backup préalable si le fichier
 * existait). Retourne le chemin du backup, ou null si le fichier n'existait pas.
 */
export function resetConfigFile(target: ConfigTarget, locale: Language = "fr"): Promise<string | null> {
  return writeConfigFile(target, resetTemplate(target, locale));
}

/**
 * Supprime une cible de config en la déplaçant dans la corbeille (réversible).
 * Retourne le chemin de corbeille. Lève si le fichier n'existe pas.
 */
export function deleteConfigFile(target: ConfigTarget): Promise<string> {
  const def = TARGETS[target];
  return moveToTrash(safeResolve(def.file), {
    resource: configResource(target),
    scope: "config",
    label: def.label,
  });
}
