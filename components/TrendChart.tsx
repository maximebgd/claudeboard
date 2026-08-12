"use client";

import { useMemo, useState, type ReactNode } from "react";

/**
 * Courbe temporelle (aire) alignée sur une grille journalière **continue** : les
 * jours sans donnée sont comblés à 0 pour éviter les trous. Comme la heatmap, elle
 * couvre tout l'historique fourni et met en avant la fenêtre sélectionnée
 * (`windowFrom`/`windowTo`) via une bande surlignée. Composant **contrôlé** : il
 * remonte le jour survolé/cliqué au parent, qui rend le panneau de détail partagé.
 */

const DAY_MS = 86400000;
const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  values: number[]; // une valeur par série (même ordre que `series`)
}

export interface TrendSeries {
  label: string;
  color: string; // couleur CSS (var(...) accepté), utilisée pour le trait et l'aire
}

function ymdUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export default function TrendChart({
  points,
  series,
  windowFrom,
  windowTo,
  selectedDate,
  onHoverDate,
  onSelectDate,
  emptyLabel = "Aucune donnée sur cette période.",
}: {
  points: TrendPoint[];
  series: TrendSeries[];
  windowFrom?: string;
  windowTo?: string;
  /** Jour épinglé (marqueur accent) — géré par le parent. */
  selectedDate?: string | null;
  onHoverDate?: (date: string | null) => void;
  onSelectDate?: (date: string) => void;
  emptyLabel?: ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const stacked = series.length > 1;

  // Grille journalière continue : du premier jour de donnée (ou du début de fenêtre,
  // s'il est antérieur) jusqu'à aujourd'hui (ou la fin de fenêtre / dernier jour).
  const days = useMemo(() => {
    if (points.length === 0) return [] as { date: string; values: number[] }[];
    const byDate = new Map(points.map((p) => [p.date, p.values]));
    const dates = points.map((p) => p.date).sort();
    const todayKey = ymdUTC(Date.now());
    const startKey = [dates[0], windowFrom].filter(Boolean).sort()[0]!;
    const endKey = [dates[dates.length - 1], windowTo, todayKey].filter(Boolean).sort().reverse()[0]!;
    const start = Date.parse(startKey + "T00:00:00Z");
    const end = Date.parse(endKey + "T00:00:00Z");
    const out: { date: string; values: number[] }[] = [];
    const zero = series.map(() => 0);
    for (let t = start; t <= end; t += DAY_MS) {
      const key = ymdUTC(t);
      out.push({ date: key, values: byDate.get(key) ?? zero });
    }
    return out;
  }, [points, series, windowFrom, windowTo]);

  const totals = useMemo(() => days.map((d) => d.values.reduce((a, b) => a + b, 0)), [days]);
  const maxTotal = useMemo(() => Math.max(1, ...totals), [totals]);

  const n = days.length;
  const w = Math.max(1, n - 1);
  // Repère vertical : 100 (bas) pour 0, 8 (haut) au pic → 8 % de marge en tête.
  const y = (v: number) => 100 - (v / maxTotal) * 92;

  // Chemins d'aire empilée (une par série, du bas vers le haut).
  const paths = useMemo(() => {
    return series.map((_, s) => {
      const top: string[] = [];
      const bottom: string[] = [];
      for (let i = 0; i < n; i++) {
        const vals = days[i].values;
        let below = 0;
        for (let k = 0; k < s; k++) below += vals[k] ?? 0;
        const above = below + (vals[s] ?? 0);
        top.push(`${i},${y(above)}`);
        bottom.push(`${i},${y(below)}`);
      }
      const area = `M${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
      const line = `M${top.join(" L")}`;
      return { area, line };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, series, maxTotal]);

  // Indices (dans la grille continue) des bornes de la fenêtre, pour la bande surlignée.
  const band = useMemo(() => {
    if (!windowFrom || !windowTo || n === 0) return null;
    let lo = -1;
    let hi = -1;
    for (let i = 0; i < n; i++) {
      if (days[i].date >= windowFrom && days[i].date <= windowTo) {
        if (lo === -1) lo = i;
        hi = i;
      }
    }
    if (lo === -1) return null;
    return { lo, hi };
  }, [days, windowFrom, windowTo, n]);

  // Repères de mois pour l'axe X (position en % de la largeur).
  const monthTicks = useMemo(() => {
    const out: { pct: number; label: string }[] = [];
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const mo = Number(days[i].date.slice(5, 7)) - 1;
      if (mo !== prev) {
        out.push({ pct: (i / w) * 100, label: MONTHS_FR[mo] });
        prev = mo;
      }
    }
    return out;
  }, [days, n, w]);

  const selectedIndex = useMemo(
    () => (selectedDate ? days.findIndex((d) => d.date === selectedDate) : -1),
    [days, selectedDate],
  );

  if (n === 0) {
    return <p className="text-sm text-[var(--color-muted)]">{emptyLabel}</p>;
  }

  const setHoverIndex = (i: number | null) => {
    setHover(i);
    onHoverDate?.(i === null ? null : days[i].date);
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setHoverIndex(Math.max(0, Math.min(n - 1, Math.round(frac * w))));
  };

  const hoverDay = hover !== null ? days[hover] : null;
  const hoverPct = hover !== null ? (hover / w) * 100 : 0;

  return (
    <div>
      <div
        className="relative h-40 w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIndex(null)}
        onClick={() => hover !== null && onSelectDate?.(days[hover].date)}
      >
        <svg viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
          {band && (
            <rect
              x={band.lo}
              y={0}
              width={Math.max(band.hi - band.lo, 0.001)}
              height={100}
              fill="color-mix(in srgb, var(--color-accent) 9%, transparent)"
            />
          )}
          {/* Aires empilées : la plus haute (dernière série) dessinée en dernier. */}
          {paths.map((p, s) => (
            <path
              key={`a${s}`}
              d={p.area}
              fill={`color-mix(in srgb, ${series[s].color} ${stacked ? 45 : 20}%, transparent)`}
            />
          ))}
          {paths.map((p, s) => (
            <path
              key={`l${s}`}
              d={p.line}
              fill="none"
              stroke={series[s].color}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          ))}
          {selectedIndex >= 0 && (
            <line
              x1={selectedIndex}
              x2={selectedIndex}
              y1={0}
              y2={100}
              stroke="var(--color-fg)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              opacity={0.4}
            />
          )}
          {hover !== null && (
            <line
              x1={hover}
              x2={hover}
              y1={0}
              y2={100}
              stroke="var(--color-fg)"
              strokeWidth={1}
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
              opacity={0.5}
            />
          )}
        </svg>

        {/* Points au survol (un par série, au sommet cumulé). */}
        {hoverDay &&
          (() => {
            let below = 0;
            return series.map((se, s) => {
              below += hoverDay.values[s] ?? 0;
              return (
                <span
                  key={`d${s}`}
                  className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--color-panel)]"
                  style={{ left: `${hoverPct}%`, top: `${y(below)}%`, backgroundColor: se.color }}
                />
              );
            });
          })()}
      </div>

      {/* Axe des mois. */}
      <div className="relative mt-1.5 h-3">
        {monthTicks.map((t, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 text-[10px] text-[var(--color-faint)]"
            style={{ left: `${Math.min(98, Math.max(2, t.pct))}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* Légende (uniquement en multi-séries). */}
      {stacked && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          {series.map((se, s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: se.color }} />
              <span className="text-[var(--color-fg)]">{se.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
