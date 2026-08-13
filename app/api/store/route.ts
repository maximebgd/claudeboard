import { NextResponse } from "next/server";
import { toggleFavorite } from "@/lib/store";

/**
 * Écrit l'état applicatif de claudeboard (data/claudeboard.json). Dispatch par
 * `section` (whitelist). Pour l'instant : favoris (épinglage de sessions). Les
 * sections pricing/subscription/unlockedFields s'ajouteront ici au fil des features.
 */
export async function POST(req: Request) {
  let body: { section?: unknown; op?: unknown; key?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { section, op, key } = body;

  if (section === "favorites") {
    if (op !== "toggle") {
      return NextResponse.json({ error: "op inconnue" }, { status: 400 });
    }
    if (typeof key !== "string" || !key) {
      return NextResponse.json({ error: "clé manquante" }, { status: 400 });
    }
    try {
      const { favorited } = await toggleFavorite(key);
      return NextResponse.json({ ok: true, favorited });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'écriture";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "section inconnue" }, { status: 400 });
}
