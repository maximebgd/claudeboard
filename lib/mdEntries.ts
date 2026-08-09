import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { safeResolve } from "./claude";

/**
 * Modèle générique pour les dossiers d'entrées markdown à frontmatter de
 * ~/.claude — même logique que les skills mais pour des fichiers `.md` plats ou
 * imbriqués : `agents/*.md` et `commands/**\/*.md` (les sous-dossiers de
 * commands forment des namespaces de slash-commands).
 *
 * Le `slug` est le chemin relatif au dossier de base, sans l'extension `.md`
 * (ex. `review` ou `git/commit`). Toute écriture crée un backup horodaté.
 */
export type MdKind = "agents" | "commands";

const DIRS: Record<MdKind, string> = {
  agents: "agents",
  commands: "commands",
};

export function isMdKind(v: unknown): v is MdKind {
  return v === "agents" || v === "commands";
}

export interface MdEntryMeta {
  slug: string; // chemin relatif sans .md (ex. "git/commit")
  name: string; // frontmatter `name` sinon dernier segment du slug
  description: string;
  namespace: string | null; // dossier parent (ex. "git") ou null si à la racine
  path: string;
  updatedAt: number;
}

export interface MdEntry extends MdEntryMeta {
  content: string; // corps markdown (hors frontmatter)
  raw: string; // fichier complet
  data: Record<string, unknown>; // frontmatter parsé
}

/** Liste récursive des chemins de fichiers .md, relatifs au dossier de base. */
async function walk(baseDir: string, rel = ""): Promise<string[]> {
  const abs = safeResolve(baseDir, rel);
  let entries;
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const childRel = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) {
      out.push(...(await walk(baseDir, childRel)));
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(childRel);
    }
  }
  return out;
}

function slugFromRel(rel: string): string {
  return rel.replace(/\.md$/, "").split(path.sep).join("/");
}

export async function listMdEntries(kind: MdKind): Promise<MdEntryMeta[]> {
  const baseDir = DIRS[kind];
  const rels = await walk(baseDir);
  const out: MdEntryMeta[] = [];
  for (const rel of rels) {
    const slug = slugFromRel(rel);
    const filePath = safeResolve(baseDir, rel);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const { data } = matter(raw);
      const st = await fs.stat(filePath);
      const ns = slug.includes("/") ? slug.slice(0, slug.lastIndexOf("/")) : null;
      out.push({
        slug,
        name: (data.name as string) || slug.split("/").pop() || slug,
        description: (data.description as string) || "",
        namespace: ns,
        path: filePath,
        updatedAt: st.mtimeMs,
      });
    } catch {
      // fichier illisible / frontmatter cassé : ignoré
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

function relFromSlug(slug: string): string {
  // slug est validé en amont (pas de "..") ; safeResolve garde le filet de sécurité.
  return `${slug}.md`;
}

export async function getMdEntry(kind: MdKind, slug: string): Promise<MdEntry | null> {
  const baseDir = DIRS[kind];
  const filePath = safeResolve(baseDir, relFromSlug(slug));
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(raw);
    const st = await fs.stat(filePath);
    const ns = slug.includes("/") ? slug.slice(0, slug.lastIndexOf("/")) : null;
    return {
      slug,
      name: (data.name as string) || slug.split("/").pop() || slug,
      description: (data.description as string) || "",
      namespace: ns,
      path: filePath,
      updatedAt: st.mtimeMs,
      content,
      raw,
      data: data as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

/**
 * Écrit une entrée markdown. Vérifie que le fichier existe déjà (pas de création
 * silencieuse), crée un backup horodaté, puis écrit. Retourne le chemin du backup.
 */
export async function writeMdEntry(kind: MdKind, slug: string, raw: string): Promise<string> {
  const baseDir = DIRS[kind];
  const filePath = safeResolve(baseDir, relFromSlug(slug));
  await fs.access(filePath); // 404 implicite si absent
  const backupPath = `${filePath}.bak.${Date.now()}`;
  await fs.copyFile(filePath, backupPath);
  await fs.writeFile(filePath, raw, "utf8");
  return backupPath;
}
