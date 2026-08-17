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
import { getT } from "@/lib/i18n";

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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { kind, slug } = body;
  const op = body.op === "create" || body.op === "delete" ? body.op : "write";
  if (!isMdKind(kind)) {
    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  // Les namespaces (sous-dossiers) sont autorisés via "/", mais pas la traversée.
  if (slug.includes("..") || slug.startsWith("/")) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  const what = kind === "agents" ? "agents" : "commands";

  if (op === "delete") {
    if (!(await isAllowed(kind, "delete"))) {
      return NextResponse.json(
        { error: `Deleting ${what} is not allowed — enable it in Preferences.` },
        { status: 403 }
      );
    }
    try {
      const trashPath = await deleteMdEntry(kind, slug);
      return NextResponse.json({ ok: true, trashPath });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "create") {
    if (!isValidMdSlug(slug)) {
      return NextResponse.json(
        { error: "Invalid name (lowercase letters, digits, hyphens; use \"/\" for a namespace)." },
        { status: 400 }
      );
    }
    if (!(await isAllowed(kind, "create"))) {
      return NextResponse.json(
        { error: `Creating ${what} is not allowed — enable it in Preferences.` },
        { status: 403 }
      );
    }
    try {
      const { locale } = await getT();
      await createMdEntry(kind, slug, mdTemplate(kind, slug, locale));
      return NextResponse.json({ ok: true, slug });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // op === "write" (modification d'une entrée existante)
  const { raw } = body;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }
  try {
    matter(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid YAML frontmatter — write aborted" },
      { status: 400 }
    );
  }

  if (!(await isAllowed(kind, "modify"))) {
    return NextResponse.json(
      { error: `Modifying ${what} is not allowed — enable it in Preferences.` },
      { status: 403 }
    );
  }

  try {
    const backupPath = await writeMdEntry(kind, slug, raw);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Write failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
