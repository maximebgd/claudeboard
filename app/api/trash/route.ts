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
    const msg = e instanceof Error ? e.message : "Échec de la lecture de la corbeille";
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
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { op, id } = body;

  if (op === "restore") {
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id manquant" }, { status: 400 });
    }
    const meta = await readTrashMeta(id);
    if (!meta) {
      return NextResponse.json({ error: "Entrée introuvable" }, { status: 404 });
    }
    // Si tu pouvais le supprimer, tu peux annuler la suppression.
    if (!isPermissionResource(meta.resource) || !(await isAllowed(meta.resource, "delete"))) {
      return NextResponse.json(
        { error: "Restauration non autorisée — activez la suppression de cette ressource dans Préférences." },
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
      const msg = e instanceof Error ? e.message : "Échec de la restauration";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "empty") {
    if (!(await isAllowed("trash", "empty"))) {
      return NextResponse.json(
        { error: "Vidage non autorisé — activez-le dans Préférences." },
        { status: 403 }
      );
    }
    try {
      const count = await emptyTrash();
      return NextResponse.json({ ok: true, count });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec du vidage";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "delete") {
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id manquant" }, { status: 400 });
    }
    if (!(await isAllowed("trash", "empty"))) {
      return NextResponse.json(
        { error: "Suppression définitive non autorisée — activez le vidage dans Préférences." },
        { status: 403 }
      );
    }
    try {
      await deleteTrashEntry(id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la suppression";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "op inconnue" }, { status: 400 });
}
