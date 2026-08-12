"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Minus, TrendingUp, ChevronDown } from "lucide-react";

/**
 * Section « Vélocité » repliable : compare chaque KPI de la fenêtre courante à la
 * période précédente de même durée (N vs N-1). Le panneau se déplie/replie ; même
 * replié, l'en-tête affiche l'aperçu de la variation la plus parlante (Tokens).
 */

export interface VelocityItem {
  label: string;
  value: string; // valeur courante déjà formatée (côté serveur)
  pct: number | null; // variation % ; null = période N-1 vide → « nouveau »
}

/** Flèche + couleur + texte de la variation (hausse verte, baisse accent, stable atténué). */
function delta(pct: number | null) {
  const up = pct !== null && pct > 0;
  const down = pct !== null && pct < 0;
  return {
    color: up ? "#6bbf73" : down ? "var(--color-accent)" : "var(--color-faint)",
    Arrow: up ? ArrowUp : down ? ArrowDown : Minus,
    text: pct === null ? "nouveau" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)} %`,
  };
}

export default function VelocityPanel({
  items,
  compareLabel,
  defaultOpen = false,
}: {
  items: VelocityItem[];
  compareLabel: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Aperçu d'en-tête (visible même replié) : on met en avant la variation des Tokens,
  // à défaut le premier KPI disponible.
  const preview = items.find((it) => it.label === "Tokens") ?? items[0];
  const pv = preview ? delta(preview.pct) : null;

  return (
    <section className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left transition-colors hover:bg-[var(--color-hover)]"
      >
        <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
        <TrendingUp size={13} className="text-[var(--color-accent)]" />
        <h2 className="eyebrow text-[var(--color-muted)]">Vélocité · {compareLabel}</h2>
        {/* Aperçu compact quand replié : la variation clé reste lisible sans déplier. */}
        {!open && preview && pv && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px]">
            <span
              className="inline-flex items-center gap-0.5 font-mono font-medium tabular-nums"
              style={{ color: pv.color }}
            >
              <pv.Arrow size={12} />
              {pv.text}
            </span>
            <span className="text-[var(--color-faint)]">{preview.label.toLowerCase()}</span>
          </span>
        )}
        <ChevronDown
          size={16}
          className={`${open ? "ml-auto" : ""} shrink-0 text-[var(--color-faint)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 pt-2 lg:grid-cols-4">
          {items.map((it) => {
            const d = delta(it.pct);
            return (
              <div
                key={it.label}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] p-4"
              >
                <div className="eyebrow tracking-[0.05em]">{it.label}</div>
                <div className="mt-2.5 font-mono text-2xl font-medium leading-none tabular-nums">
                  {it.value}
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px]">
                  <span
                    className="inline-flex items-center gap-0.5 font-mono font-medium tabular-nums"
                    style={{ color: d.color }}
                  >
                    <d.Arrow size={12} />
                    {d.text}
                  </span>
                  <span className="text-[var(--color-faint)]">vs {compareLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
