"use client";

import type { HeatDay } from "./ActivityHeatmap";

/**
 * Panneau de détail d'un jour (colonne de droite), partagé par la heatmap et la
 * courbe d'activité : sessions/messages, coût estimé et répartition par modèle du
 * jour survolé (ou épinglé).
 */

export interface DetailCell {
  key: string; // YYYY-MM-DD
  data?: HeatDay;
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

export default function DayDetail({ display }: { display: DetailCell | null }) {
  return (
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
                  <span className="tabular-nums font-medium text-[var(--color-fg)]">{fmtUSD(display.data.costUSD)}</span>
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
  );
}
