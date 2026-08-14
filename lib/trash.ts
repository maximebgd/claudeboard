import fs from "fs/promises";
import path from "path";
import { CLAUDE_DIR, safeResolve } from "./claude";

/**
 * Suppression **réversible** : plutôt que d'effacer, on déplace fichier ou dossier
 * dans une corbeille horodatée sous `CLAUDE_DIR/.claudeboard-trash/`. Cohérent avec
 * l'esprit « l'écriture n'est jamais silencieuse » (les backups `.bak.<ts>` créés
 * lors des écritures) : rien n'est perdu, tout reste récupérable à la main.
 *
 * La corbeille est un dossier de premier niveau de CLAUDE_DIR : elle n'interfère
 * pas avec les scans de `skills/`, `agents/`, `commands/`, `projects/` (qui ne
 * lisent que leur propre sous-arbre).
 */
const TRASH_DIR = ".claudeboard-trash";

/**
 * Déplace `absPath` (fichier ou dossier, qui doit être dans CLAUDE_DIR) vers la
 * corbeille. Retourne le chemin de destination. Lève si la source n'existe pas.
 */
export async function moveToTrash(absPath: string): Promise<string> {
  // Filet de sécurité : on ne déplace que ce qui est dans CLAUDE_DIR.
  const rel = path.relative(CLAUDE_DIR, absPath);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Chemin hors de CLAUDE_DIR: ${absPath}`);
  }
  await fs.access(absPath); // lève si absent → l'appelant renvoie une 404

  const flat = rel.split(path.sep).join("__");
  const destDir = safeResolve(TRASH_DIR);
  await fs.mkdir(destDir, { recursive: true });
  const dest = path.join(destDir, `${flat}.${Date.now()}`);
  await fs.rename(absPath, dest);
  return dest;
}
