import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { safeResolve } from "./claude";
import { moveToTrash } from "./trash";
import { translate, type Language } from "./i18n/core";

const SKILLS_DIR = "skills";

/** Slug de dossier de skill valide : minuscules, chiffres, tirets. */
export function isValidSkillSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug);
}

/** Contenu de départ d'un nouveau SKILL.md (frontmatter + squelette), dans la langue de l'UI. */
export function skillTemplate(slug: string, locale: Language = "fr"): string {
  return `---
name: ${slug}
description: ${translate(locale, "skills.template.description")}
---

# ${slug}

${translate(locale, "skills.template.intro")}

## ${translate(locale, "skills.template.steps")}

1. …
`;
}

export interface SkillMeta {
  slug: string; // nom du dossier
  name: string; // frontmatter `name`
  description: string; // frontmatter `description`
  path: string;
  updatedAt: number;
}

export interface Skill extends SkillMeta {
  content: string; // corps markdown (hors frontmatter)
  raw: string; // fichier complet
}

export async function listSkills(): Promise<SkillMeta[]> {
  const dir = safeResolve(SKILLS_DIR);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: SkillMeta[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillPath = safeResolve(SKILLS_DIR, e.name, "SKILL.md");
    try {
      const raw = await fs.readFile(skillPath, "utf8");
      const { data } = matter(raw);
      const st = await fs.stat(skillPath);
      out.push({
        slug: e.name,
        name: data.name || e.name,
        description: data.description || "",
        path: skillPath,
        updatedAt: st.mtimeMs,
      });
    } catch {
      // dossier sans SKILL.md valide : ignoré
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSkill(slug: string): Promise<Skill | null> {
  const skillPath = safeResolve(SKILLS_DIR, slug, "SKILL.md");
  try {
    const raw = await fs.readFile(skillPath, "utf8");
    const { data, content } = matter(raw);
    const st = await fs.stat(skillPath);
    return {
      slug,
      name: data.name || slug,
      description: data.description || "",
      path: skillPath,
      updatedAt: st.mtimeMs,
      content,
      raw,
    };
  } catch {
    return null;
  }
}

/**
 * Écrit un SKILL.md. Un backup horodaté est créé à côté avant toute écriture.
 * Retourne le chemin du backup.
 */
export async function writeSkill(slug: string, raw: string): Promise<string> {
  const skillPath = safeResolve(SKILLS_DIR, slug, "SKILL.md");
  // Vérifie que le skill existe déjà (pas de création silencieuse ici).
  await fs.access(skillPath);
  const backupPath = `${skillPath}.bak.${Date.now()}`;
  await fs.copyFile(skillPath, backupPath);
  await fs.writeFile(skillPath, raw, "utf8");
  return backupPath;
}

/**
 * Crée un nouveau skill (`skills/<slug>/SKILL.md`). Refuse si le dossier existe
 * déjà (pas d'écrasement). Retourne le slug créé.
 */
export async function createSkill(slug: string, raw?: string): Promise<string> {
  const dir = safeResolve(SKILLS_DIR, slug);
  try {
    await fs.access(dir);
    throw new Error("Un skill porte déjà ce nom.");
  } catch (e) {
    if (e instanceof Error && e.message === "Un skill porte déjà ce nom.") throw e;
    // ENOENT attendu : le dossier n'existe pas, on peut créer.
  }
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "SKILL.md"), raw ?? skillTemplate(slug), "utf8");
  return slug;
}

/**
 * Supprime un skill en déplaçant tout son dossier dans la corbeille (réversible).
 * Retourne le chemin de corbeille.
 */
export async function deleteSkill(slug: string): Promise<string> {
  const dir = safeResolve(SKILLS_DIR, slug);
  return moveToTrash(dir, { resource: "skills", scope: "skill", label: slug });
}
