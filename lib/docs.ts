import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import type { Language } from "@/lib/store";

/**
 * Dossier de documentation, versionné dans le repo (pas dans ~/.claude). Les pages
 * `/docs` du site rendent ces `.md`, aussi lisibles sur GitHub. Une variante par
 * langue vit dans `docs/<locale>/` (ex. `docs/fr/`, `docs/en/`) ; le **français est
 * la source de vérité** (il définit l'ensemble des pages) et sert de **repli** quand
 * une traduction manque, page par page.
 */
const DOCS_DIR = path.join(process.cwd(), "docs");

/** Langue de repli quand une page n'existe pas dans la locale demandée. */
const FALLBACK_LOCALE: Language = "fr";

// N'accepte que des slugs simples (pas de `/`, `.` ni `..`) → garde anti-traversée.
const SLUG_RE = /^[a-z0-9-]+$/;

/** Lit le `.md` d'un slug dans une locale donnée, ou `null` s'il est absent/illisible. */
async function readDocRaw(locale: Language, slug: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(DOCS_DIR, locale, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
}

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
 * Liste les pages de doc pour une locale, triées par `order`. L'ensemble des pages
 * est défini par `docs/<FALLBACK_LOCALE>/` (source de vérité) ; chaque page prend son
 * frontmatter dans la locale demandée, avec repli sur le français si absente. Les
 * fichiers hors `SLUG_RE` (dont un éventuel `README`) sont ignorés.
 */
export async function listDocs(locale: Language = FALLBACK_LOCALE): Promise<DocMeta[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(path.join(DOCS_DIR, FALLBACK_LOCALE));
  } catch {
    return [];
  }
  const out: DocMeta[] = [];
  for (const file of entries) {
    if (!file.endsWith(".md")) continue;
    const slug = file.slice(0, -3);
    if (slug === "README" || !SLUG_RE.test(slug)) continue;
    const raw = (await readDocRaw(locale, slug)) ?? (await readDocRaw(FALLBACK_LOCALE, slug));
    if (raw == null) continue;
    try {
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

/**
 * Retourne une page de doc dans la locale demandée (repli français si la traduction
 * manque), ou `null` si le slug est invalide/absent dans les deux langues.
 */
export async function getDoc(slug: string, locale: Language = FALLBACK_LOCALE): Promise<Doc | null> {
  if (!SLUG_RE.test(slug)) return null;
  const raw = (await readDocRaw(locale, slug)) ?? (await readDocRaw(FALLBACK_LOCALE, slug));
  if (raw == null) return null;
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title || slug,
    description: data.description || "",
    order: typeof data.order === "number" ? data.order : 999,
    content,
  };
}
