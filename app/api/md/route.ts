import { NextResponse } from "next/server";
import matter from "gray-matter";
import { isMdKind, writeMdEntry } from "@/lib/mdEntries";

/**
 * Écrit une entrée markdown (agents/commands). Refuse les slugs de traversée
 * (`..`), valide le frontmatter YAML, puis écrit via writeMdEntry (backup +
 * refus de création silencieuse). Double sécurité avec safeResolve.
 */
export async function POST(req: Request) {
  let body: { kind?: unknown; slug?: unknown; raw?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { kind, slug, raw } = body;
  if (!isMdKind(kind)) {
    return NextResponse.json({ error: "type inconnu" }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "slug manquant" }, { status: 400 });
  }
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "contenu manquant" }, { status: 400 });
  }
  // Les namespaces (sous-dossiers) sont autorisés via "/", mais pas la traversée.
  if (slug.includes("..") || slug.startsWith("/")) {
    return NextResponse.json({ error: "slug invalide" }, { status: 400 });
  }
  try {
    matter(raw);
  } catch {
    return NextResponse.json(
      { error: "Frontmatter YAML invalide — écriture annulée" },
      { status: 400 }
    );
  }

  try {
    const backupPath = await writeMdEntry(kind, slug, raw);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec de l'écriture";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
