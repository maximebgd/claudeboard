import { NextResponse } from "next/server";
import { writeHooks } from "@/lib/hooks";
import { isAllowed } from "@/lib/store";

/**
 * Écrit le bloc `hooks` de settings.json (création/modification/suppression de
 * hooks = édition de ce JSON). Verrouillé par la permission hooks.modify ; le
 * corps `{ raw }` doit être un objet JSON. Backup de settings.json côté serveur.
 */
export async function POST(req: Request) {
  let body: { raw?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { raw } = body;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "contenu manquant" }, { status: 400 });
  }

  if (!(await isAllowed("hooks", "modify"))) {
    return NextResponse.json(
      { error: "Édition des hooks non autorisée — activez-la dans Préférences." },
      { status: 403 }
    );
  }

  try {
    const backupPath = await writeHooks(raw);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    const msg =
      e instanceof SyntaxError
        ? "JSON invalide — écriture annulée"
        : e instanceof Error
          ? e.message
          : "Échec de l'écriture";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
