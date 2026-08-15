"use client";

import { useState } from "react";
import { Coins, Wallet } from "lucide-react";

export interface CostStatCardProps {
  /** Coût d'usage estimé, déjà formaté (ex. « 42,00 $ »). */
  usageValue: string;
  /** Économie nette en valeur absolue, déjà formatée. */
  savingsValue: string;
  /** true si l'économie est positive (abo rentable). */
  netPositive: boolean;
  /** true si un abonnement connu existe (sinon pas de bascule possible). */
  known: boolean;
  /** Affiche l'économie d'abord (préférence utilisateur) au lieu du coût d'usage. */
  initialSavings?: boolean;
  /** Sous-titre affiché en mode « coût d'usage ». */
  usageSub?: React.ReactNode;
  /** Delta de vélocité (rendu tel quel sous la valeur). */
  trend?: React.ReactNode;
  /** Panneau riche révélé au survol de la carte. */
  tooltip?: React.ReactNode;
}

/**
 * Carte KPI « Coût estimé » cliquable : bascule entre le coût d'usage estimé et
 * l'économie nette réalisée grâce à l'abonnement (`+X $` en vert). Variante client
 * de `StatCard` — même visuel, plus l'état de bascule. Sans abonnement connu, la
 * carte reste figée sur le coût d'usage.
 */
export default function CostStatCard({
  usageValue,
  savingsValue,
  netPositive,
  known,
  initialSavings = false,
  usageSub,
  trend,
  tooltip,
}: CostStatCardProps) {
  const [showSavings, setShowSavings] = useState(initialSavings);
  const savings = showSavings && known;

  const Icon = savings ? Wallet : Coins;
  const label = savings ? "Économie abo." : "Coût estimé";
  const value = savings ? `${netPositive ? "+" : "−"}${savingsValue}` : usageValue;
  const valueColor = savings ? (netPositive ? "text-emerald-500" : "text-red-400") : "";
  const sub = usageSub;

  const card = (
    <button
      type="button"
      onClick={() => setShowSavings((s) => !s)}
      aria-pressed={savings}
      disabled={!known}
      className={`group relative h-full w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-left transition-colors hover:border-[var(--color-accent)]/45 ${
        known ? "cursor-pointer" : "cursor-default"
      }`}
    >
      {/* Tick d'accent : discret au repos, s'allonge au survol (jauge d'instrument). */}
      <span className="absolute left-0 top-0 h-6 w-px bg-[var(--color-accent)]/40 transition-all group-hover:h-10 group-hover:bg-[var(--color-accent)]" />
      <div className="flex items-center gap-1.5">
        <Icon size={14} className="shrink-0 text-[var(--color-accent)]" />
        <span className="eyebrow whitespace-nowrap tracking-[0.05em]">{label}</span>
      </div>
      <div className={`mt-3 font-mono text-[1.7rem] font-medium leading-none tabular-nums ${valueColor}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 font-mono text-[11px] text-[var(--color-faint)]">{sub}</div>}
      {trend}
    </button>
  );

  if (!tooltip) return card;

  // Wrapper `group` dédié pour que le tooltip (hors du `overflow-hidden` de la carte)
  // apparaisse au survol.
  return (
    <div className="group relative h-full">
      {card}
      <div
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-4rem)] translate-y-1 opacity-0 invisible transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
      >
        {tooltip}
      </div>
    </div>
  );
}
