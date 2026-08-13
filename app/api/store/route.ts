import { NextResponse } from "next/server";
import { toggleFavorite, toggleFavoriteProject, setPricingOverrides, setSubscription } from "@/lib/store";
import { isManualPlan } from "@/lib/subscription";

/**
 * Écrit l'état applicatif de claudeboard (data/claudeboard.json). Dispatch par
 * `section` (whitelist) : épinglage de sessions (`favorites`) et de projets
 * (`projects`), overrides de tarifs (`pricing`), abonnement (`subscription`). La
 * section unlockedFields s'ajoutera ici au fil des features.
 */
export async function POST(req: Request) {
  let body: {
    section?: unknown;
    op?: unknown;
    key?: unknown;
    overrides?: unknown;
    source?: unknown;
    plan?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { section, op, key } = body;

  if (section === "subscription") {
    if (op !== "save") {
      return NextResponse.json({ error: "op inconnue" }, { status: 400 });
    }
    const { source, plan } = body;
    if (source !== "auto" && source !== "manual") {
      return NextResponse.json({ error: "source invalide" }, { status: 400 });
    }
    if (source === "manual" && !isManualPlan(plan)) {
      return NextResponse.json({ error: "plan invalide" }, { status: 400 });
    }
    try {
      const saved = await setSubscription({ source, plan: source === "manual" ? (plan as string) : null });
      return NextResponse.json({ ok: true, subscription: saved });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'écriture";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (section === "pricing") {
    if (op !== "save") {
      return NextResponse.json({ error: "op inconnue" }, { status: 400 });
    }
    const { overrides } = body;
    if (!overrides || typeof overrides !== "object") {
      return NextResponse.json({ error: "tarifs manquants" }, { status: 400 });
    }
    try {
      const saved = await setPricingOverrides(overrides as Record<string, unknown>);
      return NextResponse.json({ ok: true, overrides: saved });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'écriture";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (section === "favorites" || section === "projects") {
    if (op !== "toggle") {
      return NextResponse.json({ error: "op inconnue" }, { status: 400 });
    }
    if (typeof key !== "string" || !key) {
      return NextResponse.json({ error: "clé manquante" }, { status: 400 });
    }
    try {
      const { favorited } =
        section === "projects" ? await toggleFavoriteProject(key) : await toggleFavorite(key);
      return NextResponse.json({ ok: true, favorited });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'écriture";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "section inconnue" }, { status: 400 });
}
