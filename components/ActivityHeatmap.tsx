"use client";

import { useState, type ReactNode } from "react";

export interface HeatDay {
  date: string; // YYYY-MM-DD (UTC)
  sessions: number;
  messages: number;
  /** Coût estimé (USD) du jour — tarifs indicatifs. */
  costUSD: number;
  /** Répartition par modèle (déjà triée, avec % pré-calculé). */
  models: { label: string; color: string; pct: number }[];
}

const DAY_MS = 86400000;
const WEEKS = 53; // ~12 mois, taille fixe (indépendante du filtre)
const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const LEVEL_ALPHA = [0, 0.22, 0.42, 0.68, 1];

function heatLevel(msgs: number, max: number): number {
  if (msgs <= 0) return 0;
  const r = msgs / max;
  if (r > 0.66) return 4;
  if (r > 0.33) return 3;
  if (r > 0.12) return 2;
  return 1;
}

function fmtUSD(n: number): string {
  if (n > 0 && n < 0.01) return "< 0,01 $";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function fmtDayLong(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Cell = { key: string; future: boolean; data?: HeatDay };

export default function ActivityHeatmap({
  days,
  windowFrom,
  windowTo,
  title,
}: {
  days: HeatDay[];
  /** Bornes (clés YYYY-MM-DD, incluses) de la fenêtre sélectionnée — jours mis en avant. */
  windowFrom?: string;
  windowTo?: string;
  /** Titre de section rendu au-dessus de la grille (dans la colonne de gauche) pour
   *  que le panneau de détail s'étende sur toute la hauteur (titre + heatmap). */
  title?: ReactNode;
}) {
  const hasWindow = !!windowFrom && !!windowTo;
  const [hover, setHover] = useState<Cell | null>(null);
  const [selected, setSelected] = useState<Cell | null>(null);

  // Le survol prime ; sinon on retombe sur le jour épinglé (clic).
  const display = hover ?? selected;

  const select = (cell: Cell) => {
    setSelected((s) => (s?.key === cell.key ? null : cell));
  };

  const map = new Map(days.map((d) => [d.date, d]));
  const maxMsgs = Math.max(1, ...days.map((d) => d.messages));

  const todayUTC = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const dow = new Date(todayUTC).getUTCDay();
  const weekStart = todayUTC - dow * DAY_MS;
  const gridStart = weekStart - (WEEKS - 1) * 7 * DAY_MS;

  const columns: Cell[][] = [];
  const monthLabels: (string | null)[] = [];
  let prevMonth = -1;
  for (let c = 0; c < WEEKS; c++) {
    const col: Cell[] = [];
    for (let r = 0; r < 7; r++) {
      const t = gridStart + (c * 7 + r) * DAY_MS;
      const key = new Date(t).toISOString().slice(0, 10);
      col.push({ key, future: t > todayUTC, data: map.get(key) });
    }
    const firstMonth = new Date(gridStart + c * 7 * DAY_MS).getUTCMonth();
    if (firstMonth !== prevMonth) {
      monthLabels.push(MONTHS_FR[firstMonth]);
      prevMonth = firstMonth;
    } else {
      monthLabels.push(null);
    }
    columns.push(col);
  }

  return (
    <div className="flex flex-wrap gap-4 lg:flex-nowrap">
      <div className="min-w-0">
        {title}
        <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-[3px]">
          <div className="flex gap-[3px] text-[10px] text-[var(--color-faint)] h-3">
            {monthLabels.map((label, i) => (
              <div key={i} className="w-3 shrink-0 whitespace-nowrap overflow-visible">
                {label}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]" onMouseLeave={() => setHover(null)}>
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((cell) => {
                  const level = cell.data ? heatLevel(cell.data.messages, maxMsgs) : 0;
                  const alpha = LEVEL_ALPHA[level];
                  const isSelected = selected?.key === cell.key;
                  const inWindow =
                    hasWindow && !cell.future && cell.key >= windowFrom! && cell.key <= windowTo!;
                  // Fenêtre active : on estompe fortement les jours hors fenêtre pour faire
                  // ressortir la sélection, sans toucher au remplissage (l'intensité reste
                  // lisible). Pas de bordure accent : elle écraserait les nuances de couleur.
                  const dimmed = hasWindow && !inWindow && !cell.future;
                  return (
                    <div
                      key={cell.key}
                      onMouseEnter={cell.future ? undefined : () => setHover(cell)}
                      onClick={cell.future ? undefined : () => select(cell)}
                      className={`h-3 w-3 rounded-[3px] ${cell.future ? "" : "cursor-pointer"}`}
                      style={{
                        backgroundColor: cell.future
                          ? "transparent"
                          : alpha === 0
                            ? "var(--color-inset)"
                            : `color-mix(in srgb, var(--color-accent) ${alpha * 100}%, transparent)`,
                        border: cell.future ? "none" : "1px solid var(--color-border)",
                        opacity: dimmed ? 0.18 : 1,
                        outline: isSelected ? "1.5px solid var(--color-fg)" : "none",
                        outlineOffset: "1px",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--color-faint)] mt-1">
            <span>Moins</span>
            {LEVEL_ALPHA.map((a, i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-[3px] border border-[var(--color-border)]"
                style={{
                  backgroundColor:
                    a === 0 ? "var(--color-inset)" : `color-mix(in srgb, var(--color-accent) ${a * 100}%, transparent)`,
                }}
              />
            ))}
            <span>Plus</span>
            <span className="ml-auto text-[var(--color-faint)]">survolez ou cliquez un jour pour le détail</span>
          </div>
        </div>
        </div>
      </div>

      {/* Panneau de détail : reste affiché à droite, suit le survol puis le jour épinglé.
          Il s'étend sur toute la hauteur de la colonne de gauche (titre + heatmap). */}
      <div className="flex-1 min-w-[220px] rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] p-4">
        {display ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-medium capitalize text-[var(--color-fg)]">{fmtDayLong(display.key)}</div>
              {display.data && display.data.messages > 0 && (
                <div className="text-xs text-[var(--color-muted)]">
                  {display.data.sessions} session{display.data.sessions > 1 ? "s" : ""} · {display.data.messages}{" "}
                  message{display.data.messages > 1 ? "s" : ""}
                </div>
              )}
            </div>
            {display.data && display.data.messages > 0 ? (
              <>
                <div className="mt-3 text-xs">
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="text-[var(--color-muted)]">Coût estimé</span>
                    <span className="tabular-nums font-medium text-[var(--color-fg)]">
                      {fmtUSD(display.data.costUSD)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[var(--color-faint)]">tarifs indicatifs</div>
                </div>
                {display.data.models.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
                    {display.data.models.map((m) => (
                      <div key={m.label} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: m.color }} />
                        <span className="text-[var(--color-fg)]">{m.label}</span>
                        <span className="tabular-nums text-[var(--color-faint)]">{m.pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-1 text-xs text-[var(--color-faint)]">Aucune activité ce jour.</div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-xs text-[var(--color-faint)]">
            Survolez ou cliquez un jour pour voir le détail.
          </div>
        )}
      </div>
    </div>
  );
}
