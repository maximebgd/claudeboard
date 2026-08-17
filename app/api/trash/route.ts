import { NextResponse } from "next/server";
import {
  listTrash,
  readTrashMeta,
  restoreTrash,
  deleteTrashEntry,
  emptyTrash,
  TrashConflictError,
} from "@/lib/trash";
import { isAllowed, PERMISSION_SCHEMA, type PermissionResource } from "@/lib/store";

function isPermissionResource(v: string): v is PermissionResource {
  return v in PERMISSION_SCHEMA;
}

/** Liste les entrées de la corbeille de claudeboard (lecture seule). */
export async function GET() {
  try {
    const entries = await listTrash();
    return NextResponse.json({ ok: true, entries });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to read trash";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Gère la corbeille : `op` = "restore" (remet l'entrée en place, verrouillé par la
 * permission `delete` de sa ressource d'origine), "delete" (supprime une entrée) ou
 * "empty" (vide tout). `delete`/`empty` sont verrouillés par `trash.empty`.
 */
export async function POST(req: Request) {
  let body: { op?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { op, id } = body;

  if (op === "restore") {
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const meta = await readTrashMeta(id);
    if (!meta) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    // Si tu pouvais le supprimer, tu peux annuler la suppression.
    if (!isPermissionResource(meta.resource) || !(await isAllowed(meta.resource, "delete"))) {
      return NextResponse.json(
        { error: "Restore is not allowed — enable deletion of this resource in Preferences." },
        { status: 403 }
      );
    }
    try {
      await restoreTrash(id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof TrashConflictError) {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      const msg = e instanceof Error ? e.message : "Restore failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "empty") {
    if (!(await isAllowed("trash", "empty"))) {
      return NextResponse.json(
        { error: "Emptying is not allowed — enable it in Preferences." },
        { status: 403 }
      );
    }
    try {
      const count = await emptyTrash();
      return NextResponse.json({ ok: true, count });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Empty failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "delete") {
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (!(await isAllowed("trash", "empty"))) {
      return NextResponse.json(
        { error: "Permanent deletion is not allowed — enable emptying in Preferences." },
        { status: 403 }
      );
    }
    try {
      await deleteTrashEntry(id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
