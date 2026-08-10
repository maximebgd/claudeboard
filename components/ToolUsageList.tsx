"use client";

import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Wrench } from "lucide-react";

/**
 * Section « Outils & skills les plus utilisés » du dashboard : titre + bouton de
 * tri croissant/décroissant par nombre d'appels (décroissant par défaut) alignés
 * sur une même ligne, puis liste de barres. La zone de barres affiche ~7 lignes
 * puis devient scrollable. Les barres restent comparables (largeur relative à
 * l'outil le plus appelé, toutes lignes confondues).
 */

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("fr-FR");

function fmtNum(n: number): string {
  return n >= 10000 ? compact.format(n) : full.format(n);
}

export interface ToolUsage {
  name: string;
  count: number;
}

export default function ToolUsageList({ tools }: { tools: ToolUsage[] }) {
  const [desc, setDesc] = useState(true);

  const maxCount = useMemo(() => Math.max(1, ...tools.map((t) => t.count)), [tools]);

  const visible = useMemo(
    () => [...tools].sort((a, b) => (desc ? b.count - a.count : a.count - b.count)),
    [tools, desc],
  );

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
        <Wrench size={13} className="text-[var(--color-accent)]" />
        <h2 className="eyebrow text-[var(--color-muted)]">Outils &amp; skills les plus utilisés</h2>
        {tools.length > 0 && (
          <button
            type="button"
            onClick={() => setDesc((d) => !d)}
            className="ml-auto flex shrink-0 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-1.5 text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            title={desc ? "Appels décroissants" : "Appels croissants"}
            aria-label={desc ? "Appels décroissants" : "Appels croissants"}
          >
            {desc ? <ArrowDownWideNarrow size={16} /> : <ArrowUpNarrowWide size={16} />}
          </button>
        )}
      </div>

      {tools.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Aucun appel d&apos;outil.</p>
      ) : (
        <div className="flex max-h-[13rem] flex-col gap-2 overflow-y-auto pr-1">
          {visible.map((t) => (
            <div key={t.name} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate font-mono text-sm" title={t.name}>
                {t.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-inset)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  style={{ width: `${(t.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                {fmtNum(t.count)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
