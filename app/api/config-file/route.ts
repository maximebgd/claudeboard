import { NextResponse } from "next/server";
import {
  isConfigTarget,
  readConfigFile,
  writeConfigFile,
  resetConfigFile,
  deleteConfigFile,
  type ConfigTarget,
} from "@/lib/configFiles";
import { isAllowed, type PermissionResource } from "@/lib/store";

/** Ressource de permission correspondant à une cible de config. */
function resourceOf(target: ConfigTarget): PermissionResource {
  if (target === "settings" || target === "settingsLocal") return "settings";
  return target === "claudeMd" ? "claudeMd" : "keybindings";
}

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
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { target } = body;
  const op = body.op === "reset" || body.op === "delete" ? body.op : "write";
  if (!isConfigTarget(target)) {
    return NextResponse.json({ error: "cible inconnue" }, { status: 400 });
  }
  const resource = resourceOf(target);

  if (op === "delete") {
    if (!(await isAllowed(resource, "delete"))) {
      return NextResponse.json(
        { error: "Suppression non autorisée — activez-la dans Préférences." },
        { status: 403 }
      );
    }
    try {
      const trashPath = await deleteConfigFile(target);
      return NextResponse.json({ ok: true, trashPath });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la suppression";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (op === "reset") {
    if (!(await isAllowed(resource, "reset"))) {
      return NextResponse.json(
        { error: "Réinitialisation non autorisée — activez-la dans Préférences." },
        { status: 403 }
      );
    }
    try {
      const backupPath = await resetConfigFile(target);
      return NextResponse.json({ ok: true, backupPath });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la réinitialisation";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // op === "write" : création (fichier absent) ou modification (fichier présent).
  const { raw } = body;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "contenu manquant" }, { status: 400 });
  }
  const { exists } = await readConfigFile(target);
  const action = resource === "settings" ? "modify" : exists ? "modify" : "create";
  if (!(await isAllowed(resource, action))) {
    const verb = action === "create" ? "Création" : "Modification";
    return NextResponse.json(
      { error: `${verb} non autorisée — activez-la dans Préférences.` },
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
        ? "JSON invalide — écriture annulée"
        : e instanceof Error
          ? e.message
          : "Échec de l'écriture";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
