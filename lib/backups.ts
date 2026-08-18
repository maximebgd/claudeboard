import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

/**
 * Historique de versions **de claudeboard** pour tout contenu texte éditable de
 * ~/.claude : les fichiers de config uniques (settings.json, settings.local.json,
 * CLAUDE.md global, keybindings.json) **et** les entrées à frontmatter (SKILL.md des
 * skills, agents/*.md, commands/**\/*.md). À chaque enregistrement (`writeConfigFile`,
 * `writeSkill`, `writeMdEntry`), la version précédente est archivée **ici** plutôt qu'à
 * côté du fichier (fini les `.bak.<ts>` qui polluaient ~/.claude).
 *
 * Cohérent avec `store.ts`/`trash.ts` : les artefacts propres à claudeboard vivent
 * **hors** du sandbox CLAUDE_DIR, à la racine du projet (`data/backups/`, gitignored).
 * Surchargeable via BACKUPS_DIR (sinon dérivé de STORE_DIR, comme le store et la corbeille).
 *
 * Disposition : `data/backups/<target>/<id>` où `<target>` est soit une cible de config
 * (`settings`, `claudeMd`, …), soit un chemin d'entrée imbriqué (`skills/<slug>`,
 * `agents/<slug>`, `commands/<ns>/<slug>`), et `<id> = <timestamp>-<rand>` (triable).
 * Le contenu du fichier est stocké tel quel. L'historique est plafonné aux
 * `MAX_VERSIONS` plus récentes par cible (les plus anciennes sont élaguées).
 */

/**
 * Cible d'archivage : une chaîne dont chaque segment (séparé par `/`) est
 * alphanumérique + tirets (les cibles de config sont camelCase, les slugs sont
 * minuscules/tirets, les namespaces de commandes ajoutent des segments). Aucun point
 * n'est autorisé → pas de `..`, pas d'astuce d'extension : le chemin reste **dans**
 * `data/backups/`.
 */
export type BackupTarget = string;

/** Garde anti-traversée : valide qu'une cible ne peut désigner que `data/backups/…`. */
function isValidTarget(target: string): boolean {
  if (!target) return false;
  return target.split("/").every((seg) => /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(seg));
}

function assertValidTarget(target: string): void {
  if (!isValidTarget(target)) throw new Error("Cible de version invalide.");
}
const STORE_DIR = process.env.STORE_DIR || path.join(process.cwd(), "data");
const BACKUPS_ROOT = process.env.BACKUPS_DIR || path.join(STORE_DIR, "backups");

/** Nombre de versions conservées par cible (les plus anciennes sont supprimées). */
export const MAX_VERSIONS = 10;

/** Identifiant de version : `<timestamp>-<rand>` (unique, triable). */
function newId(): string {
  return `${Date.now()}-${randomBytes(2).toString("hex")}`;
}

/** Garde-fou anti-traversée : un id de version doit avoir cette forme exacte. */
function isValidId(id: string): boolean {
  return /^\d+-[a-f0-9]+$/.test(id);
}

/** Une version archivée d'une cible de config. */
export interface BackupEntry {
  id: string;
  /** Instant de l'archivage (ms), dérivé de l'id. */
  savedAt: number;
  /** Taille du contenu archivé (octets). */
  size: number;
  /** `true` si le contenu de cette version est identique au fichier actuel. */
  current?: boolean;
}

function targetDir(target: BackupTarget): string {
  assertValidTarget(target);
  return path.join(BACKUPS_ROOT, target);
}

/**
 * Archive `content` comme nouvelle version de `target`, puis élague l'historique
 * au-delà de `MAX_VERSIONS`. Retourne le chemin du fichier de version créé.
 */
export async function saveBackup(target: BackupTarget, content: string): Promise<string> {
  const dir = targetDir(target);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, newId());
  await fs.writeFile(filePath, content, "utf8");
  await pruneOld(target);
  return filePath;
}

/**
 * Liste les versions d'une cible, plus récentes d'abord. `[]` si aucune. Si
 * `currentContent` est fourni, marque `current: true` les versions dont le contenu
 * est identique (le fichier actuel correspond à cette version — p. ex. après une
 * restauration ou un enregistrement sans changement).
 */
export async function listBackups(
  target: BackupTarget,
  currentContent?: string
): Promise<BackupEntry[]> {
  const dir = targetDir(target);
  let ids: string[];
  try {
    ids = await fs.readdir(dir);
  } catch {
    return [];
  }
  const entries: BackupEntry[] = [];
  for (const id of ids) {
    if (!isValidId(id)) continue;
    const filePath = path.join(dir, id);
    let size = 0;
    try {
      size = (await fs.stat(filePath)).size;
    } catch {
      continue;
    }
    let current: boolean | undefined;
    if (currentContent !== undefined) {
      try {
        current = (await fs.readFile(filePath, "utf8")) === currentContent;
      } catch {
        current = false;
      }
    }
    entries.push({ id, savedAt: Number(id.split("-")[0]), size, current });
  }
  return entries.sort((a, b) => b.savedAt - a.savedAt);
}

/** Lit le contenu d'une version. Lève si l'id est invalide ou introuvable. */
export async function readBackup(target: BackupTarget, id: string): Promise<string> {
  if (!isValidId(id)) throw new Error("Version invalide.");
  return fs.readFile(path.join(targetDir(target), id), "utf8");
}

/**
 * Supprime **définitivement** une version archivée. Contrairement aux fichiers de
 * ~/.claude (qui passent par la corbeille), les backups sont déjà le filet de
 * sécurité de claudeboard : élaguer une version est donc une suppression directe.
 * Lève si l'id est invalide ; no-op silencieux si le fichier n'existe pas.
 */
export async function deleteBackup(target: BackupTarget, id: string): Promise<void> {
  if (!isValidId(id)) throw new Error("Version invalide.");
  await fs.rm(path.join(targetDir(target), id), { force: true });
}

/** Supprime les versions au-delà des `MAX_VERSIONS` plus récentes. */
async function pruneOld(target: BackupTarget): Promise<void> {
  const entries = await listBackups(target);
  for (const e of entries.slice(MAX_VERSIONS)) {
    await fs.rm(path.join(targetDir(target), e.id), { force: true });
  }
}
