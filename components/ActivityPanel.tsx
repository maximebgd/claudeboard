"use client";

import { useState } from "react";
import { LayoutGrid, TrendingUp, Flame } from "lucide-react";
import type { StreakStat } from "@/lib/analytics";
import ActivityHeatmap, { type HeatDay } from "./ActivityHeatmap";
import TrendChart, { type TrendPoint } from "./TrendChart";
import DayDetail, { type DetailCell } from "./DayDetail";

/**
 * Section « Activité » du dashboard : bascule entre la heatmap (grille façon GitHub)
 * et une courbe des messages par jour. Les deux vues couvrent tout l'historique,
 * surlignent la fenêtre sélectionnée et partagent le **même panneau de détail** à
 * droite (`DayDetail`) — l'état de survol/épinglage vit donc ici.
 */

type View = "heatmap" | "trend";

const seg = (on: boolean) =>
  `flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
    on
      ? "bg-[var(--color-panel)] text-[var(--color-fg)] shadow-sm"
      : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
  }`;

/** Jour `YYYY-MM-DD` (UTC) → « 13 juil. » (cohérent avec les clés de la heatmap). */
function fmtDay(dayKey: string): string {
  return new Date(dayKey + "T00:00:00Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Badge compact de série (streak) dans l'en-tête : flamme + jours consécutifs en cours,
 * record en sous-texte. Le tooltip détaille l'état et les bornes du record. Rien n'est
 * rendu s'il n'y a aucun historique.
 */
function StreakBadge({ streak }: { streak: StreakStat }) {
  if (streak.longest === 0) return null;
  const alive = streak.current > 0;
  const j = (n: number) => (n > 1 ? "jours" : "jour");
  const range =
    streak.longestEnd && streak.longestEnd !== streak.longestStart
      ? ` (${fmtDay(streak.longestStart)} – ${fmtDay(streak.longestEnd)})`
      : streak.longestStart
        ? ` (${fmtDay(streak.longestStart)})`
        : "";
  const state =
    streak.current === 0
      ? "Série interrompue"
      : streak.activeToday
        ? "Série en cours · actif aujourd'hui"
        : "Série en cours";
  const title = `${state} : ${streak.current} ${j(streak.current)} · Record : ${streak.longest} ${j(
    streak.longest,
  )}${range}`;

  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] px-2.5 py-1.5 font-mono text-xs"
    >
      <Flame
        size={12}
        className={alive ? "text-[var(--color-accent)]" : "text-[var(--color-faint)]"}
      />
      <span className="tabular-nums font-medium">{streak.current}j</span>
      <span className="text-[var(--color-faint)]">· record {streak.longest}</span>
    </span>
  );
}

export default function ActivityPanel({
  days,
  streak,
  windowFrom,
  windowTo,
}: {
  days: HeatDay[];
  streak: StreakStat;
  windowFrom?: string;
  windowTo?: string;
}) {
  const [view, setView] = useState<View>("heatmap");
  const [hover, setHover] = useState<DetailCell | null>(null);
  const [selected, setSelected] = useState<DetailCell | null>(null);

  // Le survol prime ; sinon on retombe sur le jour épinglé (clic).
  const display = hover ?? selected;

  const map = new Map(days.map((d) => [d.date, d]));
  const cellFor = (key: string): DetailCell => ({ key, data: map.get(key) });
  const select = (cell: DetailCell) => setSelected((s) => (s?.key === cell.key ? null : cell));

  const switchView = (v: View) => {
    setView(v);
    setHover(null); // évite un survol résiduel d'une vue à l'autre
  };

  const trendPoints: TrendPoint[] = days.map((d) => ({ date: d.date, values: [d.messages] }));

  const header = (
    <div className="mb-4 flex items-center gap-2">
      <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
      <h2 className="eyebrow text-[var(--color-muted)]">Activité · 12 derniers mois</h2>
      <StreakBadge streak={streak} />
      <div className="ml-auto inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5">
        <button type="button" onClick={() => switchView("heatmap")} className={seg(view === "heatmap")}>
          <LayoutGrid size={12} /> Heatmap
        </button>
        <button type="button" onClick={() => switchView("trend")} className={seg(view === "trend")}>
          <TrendingUp size={12} /> Courbe
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-4 lg:flex-nowrap">
      <div className="min-w-0">
        {header}
        {/* Réserve de hauteur uniquement pour la courbe (≈ 178 px, plus haute que la
            grille ≈ 140 px). En heatmap on laisse la hauteur naturelle gouverner, pour
            que le panneau de détail (colonne de droite, qui s'étire pour matcher) s'aligne
            pile sur la légende « Moins … Plus » sans dépasser. */}
        <div className={view === "trend" ? "min-h-[178px]" : ""}>
          {view === "heatmap" ? (
            <ActivityHeatmap
              days={days}
              windowFrom={windowFrom}
              windowTo={windowTo}
              selectedKey={selected?.key ?? null}
              onHover={setHover}
              onSelect={select}
            />
          ) : (
            // La courbe n'a pas de largeur intrinsèque (contrairement à la grille) : on
            // la cale sur la largeur de la heatmap (53 cellules de 12 px + 52 gaps de 3 px
            // = 792 px) pour que la colonne de gauche — et donc le panneau de détail —
            // garde exactement la même taille d'une vue à l'autre.
            <div className="w-[792px] max-w-full">
              <TrendChart
                points={trendPoints}
                series={[{ label: "Messages", color: "var(--color-accent)" }]}
                windowFrom={windowFrom}
                windowTo={windowTo}
                selectedDate={selected?.key ?? null}
                onHoverDate={(date) => setHover(date ? cellFor(date) : null)}
                onSelectDate={(date) => select(cellFor(date))}
                emptyLabel="Aucune activité sur cette période."
              />
            </div>
          )}
        </div>
      </div>
      <DayDetail display={display} />
    </div>
  );
}
