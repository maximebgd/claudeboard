"use client";

import type { DetailCell } from "./DayDetail";

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

type Cell = { key: string; future: boolean; data?: HeatDay };

/**
 * Grille d'activité façon GitHub (53 semaines fixes). Composant **contrôlé** : il
 * n'affiche que la grille et remonte le jour survolé/cliqué à son parent
 * (`ActivityPanel`), qui possède l'état et rend le panneau de détail partagé.
 */
export default function ActivityHeatmap({
  days,
  windowFrom,
  windowTo,
  selectedKey,
  onHover,
  onSelect,
}: {
  days: HeatDay[];
  /** Bornes (clés YYYY-MM-DD, incluses) de la fenêtre sélectionnée — jours mis en avant. */
  windowFrom?: string;
  windowTo?: string;
  /** Clé du jour épinglé (pour l'entourage) — géré par le parent. */
  selectedKey: string | null;
  onHover: (cell: DetailCell | null) => void;
  onSelect: (cell: DetailCell) => void;
}) {
  const hasWindow = !!windowFrom && !!windowTo;

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
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-[3px]">
        <div className="flex gap-[3px] text-[10px] text-[var(--color-faint)] h-3">
          {monthLabels.map((label, i) => (
            <div key={i} className="w-3 shrink-0 whitespace-nowrap overflow-visible">
              {label}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px]" onMouseLeave={() => onHover(null)}>
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell) => {
                const level = cell.data ? heatLevel(cell.data.messages, maxMsgs) : 0;
                const alpha = LEVEL_ALPHA[level];
                const isSelected = selectedKey === cell.key;
                const inWindow = hasWindow && !cell.future && cell.key >= windowFrom! && cell.key <= windowTo!;
                // Fenêtre active : on estompe fortement les jours hors fenêtre pour faire
                // ressortir la sélection, sans toucher au remplissage (l'intensité reste
                // lisible). Pas de bordure accent : elle écraserait les nuances de couleur.
                const dimmed = hasWindow && !inWindow && !cell.future;
                return (
                  <div
                    key={cell.key}
                    onMouseEnter={cell.future ? undefined : () => onHover({ key: cell.key, data: cell.data })}
                    onClick={cell.future ? undefined : () => onSelect({ key: cell.key, data: cell.data })}
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
  );
}
