"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

/** Sous-ensemble de `ModelStat` (lib/analytics) nécessaire au camembert.
 *  Défini localement pour garder ce composant client indépendant de `lib`
 *  (qui dépend de `fs`). */
export interface DonutModel {
  key: string;
  label: string;
  color: string;
  messages: number; // réponses de l'assistant (messages OUT)
  messagesIn: number; // messages utilisateur (IN)
  tokensIn: number;
  tokensOut: number;
}

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("fr-FR");

function fmtNum(n: number): string {
  return n >= 10000 ? compact.format(n) : full.format(n);
}

const R = 15.9155; // circonférence ≈ 100 → dasharray en %

export default function ModelDonut({ models }: { models: DonutModel[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = models.reduce((n, m) => n + m.messages, 0);
  const hovered = active ? models.find((m) => m.key === active) ?? null : null;

  let acc = 0;

  return (
    <div className="flex items-start gap-5">
      <div className="relative h-36 w-36 shrink-0" onMouseLeave={() => setActive(null)}>
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r={R} fill="none" stroke="var(--color-inset)" strokeWidth="5" />
          {total > 0 &&
            models.map((m) => {
              const pct = (m.messages / total) * 100;
              if (pct <= 0) return null;
              const dimmed = active !== null && active !== m.key;
              const seg = (
                <circle
                  key={m.key}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={m.color}
                  strokeWidth={active === m.key ? 6.5 : 5}
                  strokeDasharray={`${pct} ${100 - pct}`}
                  strokeDashoffset={-acc}
                  className="cursor-pointer transition-[stroke-width,opacity]"
                  style={{ opacity: dimmed ? 0.3 : 1 }}
                  onMouseEnter={() => setActive(m.key)}
                />
              );
              acc += pct;
              return seg;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-medium tabular-nums">{fmtNum(hovered ? hovered.messages : total)}</span>
          <span className="eyebrow mt-0.5">réponses</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        {models.map((m) => {
          const pct = total > 0 ? (m.messages / total) * 100 : 0;
          const isActive = active === m.key;
          return (
            <div
              key={m.key}
              className="relative flex flex-col rounded-md px-1.5 py-1 -mx-1.5 cursor-pointer transition-colors"
              style={{ backgroundColor: isActive ? "var(--color-inset)" : "transparent" }}
              onMouseEnter={() => setActive(m.key)}
              onMouseLeave={() => setActive(null)}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: m.color }} />
                <span className="text-[var(--color-fg)]">{m.label}</span>
                <span className="font-mono text-[var(--color-faint)] tabular-nums">{pct.toFixed(0)}%</span>
              </div>
              {isActive && (
                // Overlay flottant : hors du flux (`absolute`) pour ne pas décaler les
                // lignes voisines → pas de « saut » quand on survole de modèle en modèle.
                <div className="absolute left-0 top-full z-10 mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-2 shadow-lg font-mono text-xs tabular-nums text-[var(--color-muted)]">
                  <div className="flex items-center gap-3">
                    <span className="w-10 font-sans text-[var(--color-faint)]">Msg</span>
                    <span className="inline-flex items-center gap-1">
                      <ArrowUp size={12} className="text-[var(--color-accent)]" />
                      {fmtNum(m.messagesIn)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ArrowDown size={12} className="text-[var(--color-accent)]" />
                      {fmtNum(m.messages)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <span className="w-10 font-sans text-[var(--color-faint)]">Tok</span>
                    <span className="inline-flex items-center gap-1">
                      <ArrowUp size={12} className="text-[var(--color-accent)]" />
                      {fmtNum(m.tokensIn)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ArrowDown size={12} className="text-[var(--color-accent)]" />
                      {fmtNum(m.tokensOut)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
