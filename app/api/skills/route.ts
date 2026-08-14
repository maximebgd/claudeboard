import { NextResponse } from "next/server";
import matter from "gray-matter";
import {
  writeSkill,
  createSkill,
  deleteSkill,
  isValidSkillSlug,
  skillTemplate,
} from "@/lib/skills";
import { isAllowed } from "@/lib/store";

/**
 * Écrit / crée / supprime un skill. `op` : "write" (défaut, modification),
 * "create" (nouveau SKILL.md depuis template), "delete" (corbeille réversible).
 * Chaque opération est verrouillée par la permission skills.{modify,create,delete}.
 */
export async function POST(req: Request) {
  let body: { op?: unknown; slug?: unknown; raw?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { slug } = body;
  const op = body.op === "create" || body.op === "delete" ? body.op : "write";
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "slug manquant" }, { status: 400 });
  }
  // Refuse un slug tenté de traversée (double sécurité avec safeResolve).
  if (slug.includes("/") || slug.includes("..")) {
    return NextResponse.json({ error: "slug invalide" }, { status: 400 });
  }

  if (op === "delete") {
    if (!(await isAllowed("skills", "delete"))) {
      return NextResponse.json(
        { error: "Suppression des skills non autorisée — activez-la dans Préférences." },
        { status: 403 }
      );
    }
    try {
      const trashPath = await deleteSkill(slug);
      return NextResponse.json({ ok: true, trashPath });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la suppression";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "create") {
    if (!isValidSkillSlug(slug)) {
      return NextResponse.json(
        { error: "Nom invalide (minuscules, chiffres et tirets uniquement)." },
        { status: 400 }
      );
    }
    if (!(await isAllowed("skills", "create"))) {
      return NextResponse.json(
        { error: "Création de skills non autorisée — activez-la dans Préférences." },
        { status: 403 }
      );
    }
    try {
      await createSkill(slug, skillTemplate(slug));
      return NextResponse.json({ ok: true, slug });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la création";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // op === "write" (modification d'un skill existant)
  const { raw } = body;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "contenu manquant" }, { status: 400 });
  }
  // Valide que le frontmatter reste parsable pour éviter d'écrire un skill cassé.
  try {
    matter(raw);
  } catch {
    return NextResponse.json(
      { error: "Frontmatter YAML invalide — écriture annulée" },
      { status: 400 }
    );
  }

  if (!(await isAllowed("skills", "modify"))) {
    return NextResponse.json(
      { error: "Modification des skills non autorisée — activez-la dans Préférences." },
      { status: 403 }
    );
  }

  try {
    const backupPath = await writeSkill(slug, raw);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec de l'écriture";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
