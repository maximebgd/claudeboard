import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { safeResolve } from "./claude";
import { moveToTrash } from "./trash";
import { saveBackup } from "./backups";
import { translate, type Language } from "./i18n/core";

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

/** Slug valide : segments minuscules/chiffres/tirets, éventuellement imbriqués. */
export function isValidMdSlug(slug: string): boolean {
  return slug.split("/").every((seg) => /^[a-z0-9][a-z0-9-]*$/.test(seg));
}

/** Contenu de départ d'une nouvelle entrée markdown (frontmatter adapté au kind), dans la langue de l'UI. */
export function mdTemplate(kind: MdKind, slug: string, locale: Language = "fr"): string {
  const name = slug.split("/").pop() || slug;
  if (kind === "agents") {
    return `---
name: ${name}
description: ${translate(locale, "agents.template.description")}
---

${translate(locale, "agents.template.body")}
`;
  }
  return `---
description: ${translate(locale, "commands.template.description")}
---

${translate(locale, "commands.template.body", { slug })}
`;
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
 * Écrit une entrée markdown. La version précédente est archivée dans l'historique de
 * versions (`data/backups/<kind>/<slug>/`, **hors** de ~/.claude — cf. `backups.ts`),
 * restaurable depuis le panneau « Versions ». La lecture préalable garantit qu'on
 * n'écrit jamais une entrée inexistante (pas de création silencieuse). Retourne le
 * chemin de la version archivée.
 */
export async function writeMdEntry(kind: MdKind, slug: string, raw: string): Promise<string> {
  const baseDir = DIRS[kind];
  const filePath = safeResolve(baseDir, relFromSlug(slug));
  const prev = await fs.readFile(filePath, "utf8"); // lève si absent → pas de création
  const backupPath = await saveBackup(`${kind}/${slug}`, prev);
  await fs.writeFile(filePath, raw, "utf8");
  return backupPath;
}

/**
 * Crée une nouvelle entrée markdown (`<kind>/<slug>.md`, sous-dossiers créés au
 * besoin pour les namespaces). Refuse si le fichier existe déjà. Retourne le slug.
 */
export async function createMdEntry(kind: MdKind, slug: string, raw?: string): Promise<string> {
  const baseDir = DIRS[kind];
  const filePath = safeResolve(baseDir, relFromSlug(slug));
  try {
    await fs.access(filePath);
    throw new Error("Une entrée porte déjà ce nom.");
  } catch (e) {
    if (e instanceof Error && e.message === "Une entrée porte déjà ce nom.") throw e;
    // ENOENT attendu : on peut créer.
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, raw ?? mdTemplate(kind, slug), "utf8");
  return slug;
}

/** Supprime une entrée markdown en la déplaçant dans la corbeille (réversible). */
export async function deleteMdEntry(kind: MdKind, slug: string): Promise<string> {
  const baseDir = DIRS[kind];
  const filePath = safeResolve(baseDir, relFromSlug(slug));
  const scope = kind === "agents" ? "agent" : "command";
  return moveToTrash(filePath, { resource: kind, scope, label: slug });
}
