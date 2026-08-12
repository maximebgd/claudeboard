"use client";

import { useState } from "react";
import { LayoutGrid, TrendingUp } from "lucide-react";
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

export default function ActivityPanel({
  days,
  windowFrom,
  windowTo,
}: {
  days: HeatDay[];
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
        {/* Hauteur mini commune aux deux vues pour éviter tout saut vertical au
            basculement (la courbe ≈ 178 px est plus haute que la grille ≈ 140 px). */}
        <div className="min-h-[178px]">
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
