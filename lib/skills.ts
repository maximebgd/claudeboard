import fs from "fs/promises";
import matter from "gray-matter";
import { safeResolve } from "./claude";

const SKILLS_DIR = "skills";

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
