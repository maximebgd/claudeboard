"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

/**
 * Bouton d'épinglage d'une session. Optimiste (bascule tout de suite, revert si
 * l'appel échoue), écrit dans le store via /api/store. Deux variantes :
 * - `icon` : étoile seule (lignes de liste) ;
 * - `labeled` : étoile + « Épingler / Épinglé » (en-tête de session).
 * `refresh` re-rend le Server Component parent (utile quand la liste elle-même
 * dépend des favoris, ex. la section « Sessions épinglées » du dashboard).
 */
export default function FavoriteButton({
  favoriteKey,
  initial,
  variant = "icon",
  refresh = false,
  section = "favorites",
}: {
  favoriteKey: string;
  initial: boolean;
  variant?: "icon" | "labeled";
  refresh?: boolean;
  /** Cible d'épinglage : sessions (`favorites`) ou projets (`projects`). */
  section?: "favorites" | "projects";
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // Le bouton peut être enfant/voisin d'un Link : on neutralise la navigation.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !on;
    setOn(next); // optimiste
    setBusy(true);
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, op: "toggle", key: favoriteKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      setOn(data.favorited);
      if (refresh) router.refresh();
    } catch {
      setOn(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  const star = (
    <Star
      size={variant === "labeled" ? 13 : 15}
      className={on ? "fill-[var(--color-accent)] text-[var(--color-accent)]" : ""}
    />
  );
  const target = section === "projects" ? "ce projet" : "cette session";
  const title = on ? "Retirer des favoris" : `Épingler ${target}`;

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={title}
        className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-default disabled:opacity-60 ${
          on
            ? "border-[var(--color-accent)] text-[var(--color-accent)]"
            : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        }`}
      >
        {star}
        {on ? "Épinglé" : "Épingler"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={title}
      aria-pressed={on}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-lg border p-1.5 transition-colors disabled:cursor-default disabled:opacity-60 ${
        on
          ? "border-[var(--color-accent)] text-[var(--color-accent)]"
          : "border-[var(--color-border)] text-[var(--color-faint)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      }`}
    >
      {star}
    </button>
  );
}
