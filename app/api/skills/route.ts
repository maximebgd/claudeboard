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
import { getT } from "@/lib/i18n";

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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug } = body;
  const op = body.op === "create" || body.op === "delete" ? body.op : "write";
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  // Refuse un slug tenté de traversée (double sécurité avec safeResolve).
  if (slug.includes("/") || slug.includes("..")) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  if (op === "delete") {
    if (!(await isAllowed("skills", "delete"))) {
      return NextResponse.json(
        { error: "Deleting skills is not allowed — enable it in Preferences." },
        { status: 403 }
      );
    }
    try {
      const trashPath = await deleteSkill(slug);
      return NextResponse.json({ ok: true, trashPath });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "create") {
    if (!isValidSkillSlug(slug)) {
      return NextResponse.json(
        { error: "Invalid name (lowercase letters, digits and hyphens only)." },
        { status: 400 }
      );
    }
    if (!(await isAllowed("skills", "create"))) {
      return NextResponse.json(
        { error: "Creating skills is not allowed — enable it in Preferences." },
        { status: 403 }
      );
    }
    try {
      const { locale } = await getT();
      await createSkill(slug, skillTemplate(slug, locale));
      return NextResponse.json({ ok: true, slug });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // op === "write" (modification d'un skill existant)
  const { raw } = body;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }
  // Valide que le frontmatter reste parsable pour éviter d'écrire un skill cassé.
  try {
    matter(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid YAML frontmatter — write aborted" },
      { status: 400 }
    );
  }

  if (!(await isAllowed("skills", "modify"))) {
    return NextResponse.json(
      { error: "Modifying skills is not allowed — enable it in Preferences." },
      { status: 403 }
    );
  }

  try {
    const backupPath = await writeSkill(slug, raw);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Write failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
