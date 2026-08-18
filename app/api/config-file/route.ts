import { NextResponse } from "next/server";
import {
  isConfigTarget,
  configResource,
  readConfigFile,
  writeConfigFile,
  resetConfigFile,
  deleteConfigFile,
} from "@/lib/configFiles";
import { isAllowed } from "@/lib/store";
import { getT } from "@/lib/i18n";

/**
 * Gère les fichiers de config uniques de ~/.claude (settings.json,
 * settings.local.json, CLAUDE.md global, keybindings.json). `op` : "write"
 * (défaut, création/modification), "reset" (restaure le défaut, backup), "delete"
 * (corbeille réversible). Chaque opération est verrouillée par la permission
 * adéquate ; les cibles JSON sont validées et un backup est fait si utile.
 */
export async function POST(req: Request) {
  let body: { op?: unknown; target?: unknown; raw?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { target } = body;
  const op = body.op === "reset" || body.op === "delete" ? body.op : "write";
  if (!isConfigTarget(target)) {
    return NextResponse.json({ error: "Unknown target" }, { status: 400 });
  }
  const resource = configResource(target);

  if (op === "delete") {
    if (!(await isAllowed(resource, "delete"))) {
      return NextResponse.json(
        { error: "Deleting is not allowed — enable it in Preferences." },
        { status: 403 }
      );
    }
    try {
      const trashPath = await deleteConfigFile(target);
      return NextResponse.json({ ok: true, trashPath });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "reset") {
    if (!(await isAllowed(resource, "reset"))) {
      return NextResponse.json(
        { error: "Reset is not allowed — enable it in Preferences." },
        { status: 403 }
      );
    }
    try {
      const { locale } = await getT();
      const backupPath = await resetConfigFile(target, locale);
      return NextResponse.json({ ok: true, backupPath });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Reset failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // op === "write" : création (fichier absent) ou modification (fichier présent).
  const { raw } = body;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }
  const { exists } = await readConfigFile(target);
  const action = resource === "settings" ? "modify" : exists ? "modify" : "create";
  if (!(await isAllowed(resource, action))) {
    const verb = action === "create" ? "Creating" : "Modifying";
    return NextResponse.json(
      { error: `${verb} is not allowed — enable it in Preferences.` },
      { status: 403 }
    );
  }

  try {
    const backupPath = await writeConfigFile(target, raw);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    // JSON.parse échoué sur une cible JSON, ou erreur FS.
    const msg =
      e instanceof SyntaxError
        ? "Invalid JSON — write aborted"
        : e instanceof Error
          ? e.message
          : "Write failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
