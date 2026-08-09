"use client";

import { useEffect, useRef, useState } from "react";

export interface HeatDay {
  date: string; // YYYY-MM-DD (UTC)
  sessions: number;
  messages: number;
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
type Hover = { cell: Cell; x: number; y: number };

const HOVER_DELAY = 250; // ms avant apparition du tooltip

export default function ActivityHeatmap({ days }: { days: HeatDay[] }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pos = useRef({ x: 0, y: 0 });

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const enter = (cell: Cell, e: React.MouseEvent) => {
    pos.current = { x: e.clientX, y: e.clientY };
    // Tooltip déjà visible : on change de case sans re-délai.
    if (hover) {
      setHover({ cell, ...pos.current });
      return;
    }
    clearTimer();
    timer.current = setTimeout(() => setHover({ cell, ...pos.current }), HOVER_DELAY);
  };
  const move = (e: React.MouseEvent) => {
    pos.current = { x: e.clientX, y: e.clientY };
    setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
  };
  const leave = () => {
    clearTimer();
    setHover(null);
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

  const tipLeft = hover ? Math.min(hover.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 252) : 0;

  return (
    <div className="overflow-x-auto pb-1" onMouseLeave={leave}>
      <div className="inline-flex flex-col gap-[3px]">
        <div className="flex gap-[3px] text-[10px] text-[var(--color-faint)] h-3">
          {monthLabels.map((label, i) => (
            <div key={i} className="w-3 shrink-0 whitespace-nowrap overflow-visible">
              {label}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px]" onMouseMove={move}>
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell) => {
                const level = cell.data ? heatLevel(cell.data.messages, maxMsgs) : 0;
                const alpha = LEVEL_ALPHA[level];
                return (
                  <div
                    key={cell.key}
                    onMouseEnter={cell.future ? undefined : (e) => enter(cell, e)}
                    className="h-3 w-3 rounded-[3px]"
                    style={{
                      backgroundColor: cell.future
                        ? "transparent"
                        : alpha === 0
                          ? "var(--color-inset)"
                          : `color-mix(in srgb, var(--color-accent) ${alpha * 100}%, transparent)`,
                      border: cell.future ? "none" : "1px solid var(--color-border)",
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
        </div>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 w-60 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3 shadow-lg text-xs"
          style={{ left: tipLeft, top: hover.y + 16 }}
        >
          <div className="font-medium text-[var(--color-fg)]">{fmtDayLong(hover.cell.key)}</div>
          {hover.cell.data && hover.cell.data.messages > 0 ? (
            <>
              <div className="mt-0.5 text-[var(--color-muted)]">
                {hover.cell.data.sessions} session{hover.cell.data.sessions > 1 ? "s" : ""} · {hover.cell.data.messages}{" "}
                message{hover.cell.data.messages > 1 ? "s" : ""}
              </div>
              {hover.cell.data.models.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {hover.cell.data.models.map((m) => (
                    <div key={m.label} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: m.color }} />
                      <span className="text-[var(--color-fg)]">{m.label}</span>
                      <span className="ml-auto tabular-nums text-[var(--color-faint)]">{m.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="mt-0.5 text-[var(--color-faint)]">Aucune activité</div>
          )}
        </div>
      )}
    </div>
  );
}
