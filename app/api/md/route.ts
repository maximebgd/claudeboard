import { NextResponse } from "next/server";
import matter from "gray-matter";
import {
  isMdKind,
  writeMdEntry,
  createMdEntry,
  deleteMdEntry,
  isValidMdSlug,
  mdTemplate,
} from "@/lib/mdEntries";
import { isAllowed } from "@/lib/store";

/**
 * Écrit / crée / supprime une entrée markdown (agents/commands). `op` : "write"
 * (défaut, modification), "create" (nouveau .md depuis template), "delete"
 * (corbeille réversible). Verrouillé par la permission <kind>.{modify,create,delete}.
 * Refuse les slugs de traversée (`..`). Double sécurité avec safeResolve.
 */
export async function POST(req: Request) {
  let body: { op?: unknown; kind?: unknown; slug?: unknown; raw?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { kind, slug } = body;
  const op = body.op === "create" || body.op === "delete" ? body.op : "write";
  if (!isMdKind(kind)) {
    return NextResponse.json({ error: "type inconnu" }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "slug manquant" }, { status: 400 });
  }
  // Les namespaces (sous-dossiers) sont autorisés via "/", mais pas la traversée.
  if (slug.includes("..") || slug.startsWith("/")) {
    return NextResponse.json({ error: "slug invalide" }, { status: 400 });
  }
  const what = kind === "agents" ? "agents" : "commandes";

  if (op === "delete") {
    if (!(await isAllowed(kind, "delete"))) {
      return NextResponse.json(
        { error: `Suppression des ${what} non autorisée — activez-la dans Préférences.` },
        { status: 403 }
      );
    }
    try {
      const trashPath = await deleteMdEntry(kind, slug);
      return NextResponse.json({ ok: true, trashPath });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la suppression";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "create") {
    if (!isValidMdSlug(slug)) {
      return NextResponse.json(
        { error: "Nom invalide (minuscules, chiffres, tirets ; « / » pour un namespace)." },
        { status: 400 }
      );
    }
    if (!(await isAllowed(kind, "create"))) {
      return NextResponse.json(
        { error: `Création de ${what} non autorisée — activez-la dans Préférences.` },
        { status: 403 }
      );
    }
    try {
      await createMdEntry(kind, slug, mdTemplate(kind, slug));
      return NextResponse.json({ ok: true, slug });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la création";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // op === "write" (modification d'une entrée existante)
  const { raw } = body;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "contenu manquant" }, { status: 400 });
  }
  try {
    matter(raw);
  } catch {
    return NextResponse.json(
      { error: "Frontmatter YAML invalide — écriture annulée" },
      { status: 400 }
    );
  }

  if (!(await isAllowed(kind, "modify"))) {
    return NextResponse.json(
      { error: `Modification des ${what} non autorisée — activez-la dans Préférences.` },
      { status: 403 }
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
