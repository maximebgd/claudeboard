import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { CLAUDE_DIR, safeResolve } from "./claude";

/**
 * Corbeille **de claudeboard** : plutôt que d'effacer, on déplace fichier ou
 * dossier supprimé dans un dossier hors de ~/.claude, à la racine du projet
 * (`data/trash/`, gitignored, à côté de `data/claudeboard.json`). Cohérent avec
 * l'esprit « l'écriture n'est jamais silencieuse » (backups `.bak.<ts>`) : rien
 * n'est perdu, tout reste **restaurable** depuis la page `/config/trash`.
 *
 * Chaque entrée est un dossier `data/trash/<id>/` contenant :
 *   - `meta.json` : métadonnées de restauration (voir `TrashMeta`) ;
 *   - `payload`   : le fichier OU dossier original, tel quel.
 * Le manifest rend le restore fiable (chemin d'origine, type de nœud, ressource
 * de permission) là où l'ancien nom aplati `<rel>__<ts>` était ambigu.
 *
 * Emplacement surchargeable via TRASH_DIR (sinon dérivé de STORE_DIR, comme le
 * store). L'ancienne corbeille `CLAUDE_DIR/.claudeboard-trash` n'est plus utilisée.
 */
const STORE_DIR = process.env.STORE_DIR || path.join(process.cwd(), "data");
const TRASH_ROOT = process.env.TRASH_DIR || path.join(STORE_DIR, "trash");

/** Identifiant d'entrée : `<timestamp>-<rand>` (unique, triable). */
function newId(): string {
  return `${Date.now()}-${randomBytes(2).toString("hex")}`;
}

/** Garde-fou : un id d'entrée ne doit pas permettre de traversée de chemin. */
function isValidTrashId(id: string): boolean {
  return /^\d+-[a-f0-9]+$/.test(id);
}

/** Métadonnées d'une entrée de corbeille (sérialisées dans `meta.json`). */
export interface TrashMeta {
  id: string;
  /** Ressource de permission d'origine (skills|agents|commands|projects|claudeMd|keybindings|settings). */
  resource: string;
  /** Libellé métier pour l'affichage (skill|agent|command|project|session|config). */
  scope: string;
  /** Chemin d'origine relatif à CLAUDE_DIR (segments POSIX). */
  originalPath: string;
  /** Nom affiché. */
  label: string;
  /** Type du nœud déplacé. */
  kind: "file" | "dir";
  deletedAt: number;
}

/** Entrée listée : métadonnées + si la restauration est possible (pas de conflit). */
export interface TrashEntry extends TrashMeta {
  /** `false` si `originalPath` existe déjà (restauration refusée, cf. conflit). */
  restorable: boolean;
}

/** Champs fournis par l'appelant au moment de la suppression. */
export interface TrashInput {
  resource: string;
  scope: string;
  label: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Déplace un nœud (fichier ou dossier). `fs.rename` échoue entre systèmes de
 * fichiers distincts (EXDEV) — or la corbeille vit hors de ~/.claude, qui peut
 * être sur un autre volume : on retombe alors sur une copie récursive + suppression.
 */
async function moveNode(src: string, dest: string): Promise<void> {
  try {
    await fs.rename(src, dest);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EXDEV") {
      await fs.cp(src, dest, { recursive: true });
      await fs.rm(src, { recursive: true, force: true });
    } else {
      throw e;
    }
  }
}

/** Valide défensivement un objet `meta.json` inconnu. Retourne null si corrompu. */
function normalizeMeta(raw: unknown, id: string): TrashMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const resource = typeof o.resource === "string" ? o.resource : null;
  const originalPath = typeof o.originalPath === "string" ? o.originalPath : null;
  if (!resource || !originalPath) return null;
  return {
    id,
    resource,
    scope: typeof o.scope === "string" ? o.scope : "",
    originalPath,
    label: typeof o.label === "string" && o.label ? o.label : path.basename(originalPath),
    kind: o.kind === "dir" ? "dir" : "file",
    deletedAt: typeof o.deletedAt === "number" && Number.isFinite(o.deletedAt) ? o.deletedAt : 0,
  };
}

/**
 * Déplace `absPath` (fichier ou dossier, qui doit être dans CLAUDE_DIR) vers la
 * corbeille et écrit son manifest. Retourne l'`id` de l'entrée créée. Lève si la
 * source n'existe pas (l'appelant renvoie alors une 404).
 */
export async function moveToTrash(absPath: string, input: TrashInput): Promise<string> {
  // Filet de sécurité : on ne déplace que ce qui est dans CLAUDE_DIR.
  const rel = path.relative(CLAUDE_DIR, absPath);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Chemin hors de CLAUDE_DIR: ${absPath}`);
  }
  const st = await fs.stat(absPath); // lève si absent → 404 côté appelant
  const kind: "file" | "dir" = st.isDirectory() ? "dir" : "file";

  const id = newId();
  const entryDir = path.join(TRASH_ROOT, id);
  await fs.mkdir(entryDir, { recursive: true });
  await moveNode(absPath, path.join(entryDir, "payload"));

  const meta: TrashMeta = {
    id,
    resource: input.resource,
    scope: input.scope,
    originalPath: rel.split(path.sep).join("/"),
    label: input.label,
    kind,
    deletedAt: Date.now(),
  };
  await fs.writeFile(path.join(entryDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
  return id;
}

/**
 * Liste les entrées de la corbeille (récentes d'abord). Ignore silencieusement
 * les entrées corrompues. Marque `restorable: false` quand le chemin d'origine
 * est déjà occupé (conflit) ou non résoluble en sécurité.
 */
export async function listTrash(): Promise<TrashEntry[]> {
  let ids: string[];
  try {
    ids = await fs.readdir(TRASH_ROOT);
  } catch {
    return [];
  }
  const entries: TrashEntry[] = [];
  for (const id of ids) {
    if (!isValidTrashId(id)) continue;
    let meta: TrashMeta | null = null;
    try {
      const raw = await fs.readFile(path.join(TRASH_ROOT, id, "meta.json"), "utf8");
      meta = normalizeMeta(JSON.parse(raw), id);
    } catch {
      meta = null;
    }
    if (!meta) continue;

    let restorable = false;
    try {
      restorable = !(await pathExists(safeResolve(meta.originalPath)));
    } catch {
      restorable = false; // chemin hors sandbox : restauration refusée
    }
    entries.push({ ...meta, restorable });
  }
  return entries.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Lit le manifest d'une entrée (pour le contrôle de permission côté route). */
export async function readTrashMeta(id: string): Promise<TrashMeta | null> {
  if (!isValidTrashId(id)) return null;
  try {
    const raw = await fs.readFile(path.join(TRASH_ROOT, id, "meta.json"), "utf8");
    return normalizeMeta(JSON.parse(raw), id);
  } catch {
    return null;
  }
}

/** Erreur de conflit de restauration (cible déjà occupée). */
export class TrashConflictError extends Error {}

/**
 * Restaure une entrée à son emplacement d'origine. Refuse (sans rien écraser) si
 * la cible existe déjà. Résout le chemin via `safeResolve` (re-garde anti-traversée),
 * recrée le dossier parent au besoin, remet le payload en place puis supprime l'entrée.
 */
export async function restoreTrash(id: string): Promise<void> {
  const meta = await readTrashMeta(id);
  if (!meta) throw new Error("Entrée de corbeille introuvable ou illisible.");

  const target = safeResolve(meta.originalPath); // re-garde anti-traversée
  if (await pathExists(target)) {
    throw new TrashConflictError(
      `« ${meta.label} » existe déjà à son emplacement d'origine — supprimez ou renommez la cible avant de restaurer.`
    );
  }
  const payload = path.join(TRASH_ROOT, id, "payload");
  await fs.access(payload); // lève si le payload manque (entrée corrompue)
  await fs.mkdir(path.dirname(target), { recursive: true });
  await moveNode(payload, target);
  await fs.rm(path.join(TRASH_ROOT, id), { recursive: true, force: true });
}

/** Supprime **définitivement** une seule entrée. */
export async function deleteTrashEntry(id: string): Promise<void> {
  if (!isValidTrashId(id)) throw new Error("Entrée de corbeille invalide.");
  const entryDir = path.join(TRASH_ROOT, id);
  await fs.access(entryDir); // 404 implicite si absente
  await fs.rm(entryDir, { recursive: true, force: true });
}

/** Vide **définitivement** la corbeille. Retourne le nombre d'entrées supprimées. */
export async function emptyTrash(): Promise<number> {
  let ids: string[];
  try {
    ids = await fs.readdir(TRASH_ROOT);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const id of ids) {
    if (!isValidTrashId(id)) continue;
    await fs.rm(path.join(TRASH_ROOT, id), { recursive: true, force: true });
    removed++;
  }
  return removed;
}
