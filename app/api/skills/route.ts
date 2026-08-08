import { NextResponse } from "next/server";
import matter from "gray-matter";
import { writeSkill } from "@/lib/skills";

export async function POST(req: Request) {
  let body: { slug?: unknown; raw?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { slug, raw } = body;
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "slug manquant" }, { status: 400 });
  }
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "contenu manquant" }, { status: 400 });
  }
  // Refuse un slug tenté de traversée (double sécurité avec safeResolve).
  if (slug.includes("/") || slug.includes("..")) {
    return NextResponse.json({ error: "slug invalide" }, { status: 400 });
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

  try {
    const backupPath = await writeSkill(slug, raw);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec de l'écriture";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
