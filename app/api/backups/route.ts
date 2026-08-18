import { NextResponse } from "next/server";
import {
  isConfigTarget,
  configResource,
  readConfigFile,
  writeConfigFile,
} from "@/lib/configFiles";
import { listBackups, readBackup, deleteBackup, MAX_VERSIONS } from "@/lib/backups";
import { isAllowed } from "@/lib/store";

/**
 * Historique de versions des fichiers de config uniques de ~/.claude. Les versions
 * sont archivées automatiquement à chaque enregistrement (cf. `lib/backups.ts`),
 * **hors** de ~/.claude. Lecture (liste + aperçu) libre ; la restauration réécrit le
 * fichier via `writeConfigFile` (qui archive d'abord la version courante) et la
 * suppression d'une version élaguent l'historique : les deux sont verrouillées par la
 * permission `modify` de la ressource cible.
 */

/** GET ?target=…            → { versions } (liste, récentes d'abord). */
/** GET ?target=…&id=…       → { content } (contenu d'une version, pour aperçu/diff). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("target");
  const id = url.searchParams.get("id");
  if (!isConfigTarget(target)) {
    return NextResponse.json({ error: "Unknown target" }, { status: 400 });
  }
  if (id) {
    try {
      const content = await readBackup(target, id);
      return NextResponse.json({ content });
    } catch {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
  }
  const current = await readConfigFile(target);
  const versions = await listBackups(target, current.raw);
  return NextResponse.json({ versions, maxVersions: MAX_VERSIONS });
}

/** POST { op: "restore", target, id } → réécrit le fichier avec la version choisie. */
/** POST { op: "delete",  target, id } → supprime définitivement une version. */
export async function POST(req: Request) {
  let body: { op?: unknown; target?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { op, target, id } = body;
  if (op !== "restore" && op !== "delete") {
    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  }
  if (!isConfigTarget(target) || typeof id !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Restaurer réécrit le fichier ; supprimer élague l'historique de la cible : les
  // deux passent par la permission `modify` de la ressource cible.
  if (!(await isAllowed(configResource(target), "modify"))) {
    return NextResponse.json(
      { error: "Not allowed — enable it in Preferences." },
      { status: 403 }
    );
  }

  try {
    if (op === "delete") {
      await deleteBackup(target, id);
      return NextResponse.json({ ok: true });
    }
    const content = await readBackup(target, id);
    const backupPath = await writeConfigFile(target, content);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Operation failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
