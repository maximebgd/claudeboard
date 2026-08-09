import { NextResponse } from "next/server";
import { isConfigTarget, writeConfigFile } from "@/lib/configFiles";

/**
 * Écrit un fichier de config unique de ~/.claude (settings.json,
 * settings.local.json, CLAUDE.md global, keybindings.json). Les cibles JSON sont
 * validées avant écriture ; un backup horodaté est créé si le fichier existait.
 */
export async function POST(req: Request) {
  let body: { target?: unknown; raw?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { target, raw } = body;
  if (!isConfigTarget(target)) {
    return NextResponse.json({ error: "cible inconnue" }, { status: 400 });
  }
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "contenu manquant" }, { status: 400 });
  }

  try {
    const backupPath = await writeConfigFile(target, raw);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    // JSON.parse échoué sur une cible JSON, ou erreur FS.
    const msg = e instanceof SyntaxError
      ? "JSON invalide — écriture annulée"
      : e instanceof Error
        ? e.message
        : "Échec de l'écriture";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
