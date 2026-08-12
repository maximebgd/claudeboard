"use client";

import { useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";

export interface SubscriptionCardProps {
  known: boolean;
  label: string;
  /** Date de souscription déjà formatée (ex. « 23 mai 2026, 16:06 »), ou null. */
  sinceLabel: string | null;
  /** Montants déjà formatés côté serveur (ex. « 20,00 $ »). */
  monthlyPrice: string;
  usageCost: string;
  subCost: string;
  months: number;
  netPositive: boolean;
  netAbs: string;
}

/** Résumé « Économie nette » réutilisé dans l'en-tête (replié) et dans la grille. */
function NetSavings({ positive, abs }: { positive: boolean; abs: string }) {
  return (
    <span className={`font-mono font-medium tabular-nums ${positive ? "text-emerald-500" : "text-red-400"}`}>
      {positive ? "+" : "−"}
      {abs}
    </span>
  );
}

export default function SubscriptionCard({
  known,
  label,
  sinceLabel,
  monthlyPrice,
  usageCost,
  subCost,
  months,
  netPositive,
  netAbs,
}: SubscriptionCardProps) {
  const [open, setOpen] = useState(false);
  const netNote = netPositive ? "gagné grâce à l'abonnement" : "l'abonnement coûte plus que l'usage";

  const title = (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
      <Wallet size={13} className="text-[var(--color-accent)]" />
      <span className="eyebrow text-[var(--color-muted)]">Abonnement</span>
    </span>
  );

  // Pas d'abonnement connu : carte simple, non pliable.
  if (!known) {
    return (
      <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
        {title}
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Aucun abonnement Pro / Max détecté dans <code className="font-mono">~/.claude.json</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 p-5 text-left transition-colors hover:bg-[var(--color-hover)]"
      >
        {title}
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2.5 py-1 text-sm font-medium text-[var(--color-accent)]">
          <Wallet size={14} />
          {label}
        </span>
        {sinceLabel && (
          <span className="font-mono text-xs text-[var(--color-faint)]">depuis le {sinceLabel}</span>
        )}
        <span className="font-mono text-xs text-[var(--color-faint)]">{monthlyPrice}/mois</span>

        {/* Résumé de l'économie nette : seulement en aperçu replié (repris dans la grille). */}
        {!open && (
          <span className="flex items-center gap-1.5 text-sm">
            <span className="eyebrow text-[var(--color-muted)]">Économie nette</span>
            <NetSavings positive={netPositive} abs={netAbs} />
            <span className="font-mono text-[11px] text-[var(--color-faint)]">{netNote}</span>
          </span>
        )}

        <ChevronDown
          size={16}
          className={`ml-auto shrink-0 text-[var(--color-faint)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-[var(--color-border)] px-5 pb-5 pt-4 sm:grid-cols-3">
          <div>
            <div className="eyebrow">Coût usage estimé</div>
            <div className="mt-1 font-mono text-xl font-medium tabular-nums">{usageCost}</div>
            <div className="mt-1 font-mono text-[11px] text-[var(--color-faint)]">sans abonnement (tarifs indicatifs)</div>
          </div>
          <div>
            <div className="eyebrow">Coût abonnement</div>
            <div className="mt-1 font-mono text-xl font-medium tabular-nums">{subCost}</div>
            <div className="mt-1 font-mono text-[11px] text-[var(--color-faint)]">
              {months} mois × {monthlyPrice}
            </div>
          </div>
          <div>
            <div className="eyebrow">Économie nette</div>
            <div className="mt-1 text-xl">
              <NetSavings positive={netPositive} abs={netAbs} />
            </div>
            <div className="mt-1 font-mono text-[11px] text-[var(--color-faint)]">{netNote}</div>
          </div>
        </div>
      )}
    </section>
  );
}
