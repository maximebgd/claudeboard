import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

/**
 * Dossier de documentation, versionné dans le repo (pas dans ~/.claude). Les pages
 * `/docs` du site rendent ces mêmes fichiers `.md` : une seule source de vérité,
 * lisible aussi bien sur GitHub que dans le dashboard.
 */
const DOCS_DIR = path.join(process.cwd(), "docs");

// N'accepte que des slugs simples (pas de `/`, `.` ni `..`) → garde anti-traversée.
const SLUG_RE = /^[a-z0-9-]+$/;

export interface DocMeta {
  slug: string; // nom de fichier sans extension
  title: string; // frontmatter `title`
  description: string; // frontmatter `description`
  order: number; // frontmatter `order` (tri de la nav)
}

export interface Doc extends DocMeta {
  content: string; // corps markdown (hors frontmatter)
}

/**
 * Liste les pages de doc triées par `order`. `README.md` est exclu : c'est le
 * sommaire pour la navigation GitHub du dossier, pas une page du site.
 */
export async function listDocs(): Promise<DocMeta[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(DOCS_DIR);
  } catch {
    return [];
  }
  const out: DocMeta[] = [];
  for (const file of entries) {
    if (!file.endsWith(".md")) continue;
    const slug = file.slice(0, -3);
    if (slug === "README" || !SLUG_RE.test(slug)) continue;
    try {
      const raw = await fs.readFile(path.join(DOCS_DIR, file), "utf8");
      const { data } = matter(raw);
      out.push({
        slug,
        title: data.title || slug,
        description: data.description || "",
        order: typeof data.order === "number" ? data.order : 999,
      });
    } catch {
      // fichier illisible → on l'ignore
    }
  }
  return out.sort((a, b) => a.order - b.order);
}

/** Retourne une page de doc, ou `null` si le slug est invalide/absent. */
export async function getDoc(slug: string): Promise<Doc | null> {
  if (!SLUG_RE.test(slug)) return null;
  let raw: string;
  try {
    raw = await fs.readFile(path.join(DOCS_DIR, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title || slug,
    description: data.description || "",
    order: typeof data.order === "number" ? data.order : 999,
    content,
  };
}
