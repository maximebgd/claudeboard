"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Sélecteur de fenêtre temporelle du dashboard. Presets rapides (Tout / 30 j / 7 j)
 * + deux modes ouverts via popover, avec un calendrier maison (pas de picker natif) :
 * un mois précis (`?range=month&month=YYYY-MM`) et une période personnalisée
 * (`?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`). Le composant ne fait que naviguer ;
 * la résolution en bornes epoch se fait côté page.
 */

const PRESETS = [
  { key: "all", label: "Tout" },
  { key: "30j", label: "30 j" },
  { key: "7j", label: "7 j" },
] as const;

const MONTHS_SHORT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
const WEEKDAYS = ["lu", "ma", "me", "je", "ve", "sa", "di"];

export interface RangeSelectorProps {
  activeKey: string;
  /** YYYY-MM (préremplissage du mode « Mois »). */
  month: string;
  /** YYYY-MM-DD (préremplissage du mode « Période »). */
  from: string;
  to: string;
}

/* -------------------------------- date utils ------------------------------ */

/** `YYYY-MM-DD` à partir de composantes (mois 0-indexé) — sûr côté fuseau. */
function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function todayYmd(): string {
  const n = new Date();
  return ymd(n.getFullYear(), n.getMonth(), n.getDate());
}

function fmtMonthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return "Mois";
  return new Date(y, mo - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function fmtDayShort(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  if (!y) return d;
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/* ---------------------------------- chips --------------------------------- */

const chip = (on: boolean) =>
  `flex items-center gap-1 rounded-md px-3 py-1 font-mono text-xs tabular-nums transition-colors ${
    on
      ? "bg-[var(--color-panel)] text-[var(--color-fg)] shadow-sm"
      : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
  }`;

const popover =
  "absolute right-0 top-full z-20 mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3 shadow-lg";

const navBtn =
  "flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)] transition-colors";

/* ------------------------------- MonthPicker ------------------------------ */

function MonthPicker({ value, onPick }: { value: string; onPick: (m: string) => void }) {
  const now = new Date();
  const [vy] = value.split("-").map(Number);
  const [year, setYear] = useState(vy || now.getFullYear());
  const curY = now.getFullYear();
  const curM = now.getMonth();

  return (
    <div className="w-56">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navBtn} onClick={() => setYear((y) => y - 1)} aria-label="Année précédente">
          <ChevronLeft size={15} />
        </button>
        <span className="font-mono text-sm font-medium tabular-nums">{year}</span>
        <button
          type="button"
          className={navBtn}
          onClick={() => setYear((y) => Math.min(curY, y + 1))}
          disabled={year >= curY}
          aria-label="Année suivante"
        >
          <ChevronRight size={15} className={year >= curY ? "opacity-30" : ""} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS_SHORT.map((label, i) => {
          const key = ymd(year, i, 1).slice(0, 7);
          const on = key === value;
          const future = year > curY || (year === curY && i > curM);
          return (
            <button
              key={key}
              type="button"
              disabled={future}
              onClick={() => onPick(key)}
              className={`rounded-md py-1.5 font-mono text-xs tabular-nums transition-colors ${
                on
                  ? "bg-[var(--color-accent)] text-white"
                  : future
                    ? "text-[var(--color-faint)] opacity-40"
                    : "text-[var(--color-fg)] hover:bg-[var(--color-hover)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- DayPicker ------------------------------- */

function DayPicker({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const today = todayYmd();
  const init = from || today;
  const [iy, im] = init.split("-").map(Number);
  const [view, setView] = useState({ y: iy, m: im - 1 }); // m 0-indexé
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [hover, setHover] = useState("");

  // Bornes de la plage mise en avant (sélection en cours = start + survol).
  const [lo, hi] = useMemo(() => {
    const anchor = start;
    const other = end || (start ? hover : "");
    if (!anchor) return ["", ""];
    if (!other) return [anchor, anchor];
    return anchor <= other ? [anchor, other] : [other, anchor];
  }, [start, end, hover]);

  const cells = useMemo(() => {
    const { y, m } = view;
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // lundi = 0
    const count = new Date(y, m + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) out.push(ymd(y, m, d));
    return out;
  }, [view]);

  const pick = (day: string) => {
    if (!start || end) {
      setStart(day);
      setEnd("");
    } else {
      const [f, t] = day < start ? [day, start] : [start, day];
      setStart(f);
      setEnd(t);
    }
  };

  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const nm = m + delta;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });

  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="w-64">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navBtn} onClick={() => shift(-1)} aria-label="Mois précédent">
          <ChevronLeft size={15} />
        </button>
        <span className="font-mono text-sm font-medium capitalize tabular-nums">{monthLabel}</span>
        <button type="button" className={navBtn} onClick={() => shift(1)} aria-label="Mois suivant">
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center font-mono text-[10px] uppercase text-[var(--color-faint)]">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => setHover("")}>
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const future = day > today;
          const isEnd = day === lo || day === hi;
          const inRange = !!lo && !!hi && day >= lo && day <= hi;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onMouseEnter={() => setHover(day)}
              onClick={() => pick(day)}
              className={`h-8 rounded-md font-mono text-xs tabular-nums transition-colors ${
                isEnd
                  ? "bg-[var(--color-accent)] text-white"
                  : inRange
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-fg)]"
                    : future
                      ? "text-[var(--color-faint)] opacity-40"
                      : day === today
                        ? "text-[var(--color-accent)] hover:bg-[var(--color-hover)]"
                        : "text-[var(--color-fg)] hover:bg-[var(--color-hover)]"
              }`}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[var(--color-muted)] tabular-nums">
          {start ? fmtDayShort(start) : "…"} → {end ? fmtDayShort(end) : "…"}
        </span>
        <button
          type="button"
          onClick={() => start && end && onApply(start, end)}
          disabled={!start || !end}
          className="rounded-md bg-[var(--color-accent)] px-3 py-1 font-mono text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Appliquer
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ RangeSelector ----------------------------- */

export default function RangeSelector({ activeKey, month, from, to }: RangeSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "month" | "custom">(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Ferme le popover au clic extérieur ou sur Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const nav = (href: string) => {
    setOpen(null);
    router.push(href, { scroll: false });
  };

  const monthLabel = activeKey === "month" ? fmtMonthLabel(month) : "Mois";
  const customLabel =
    activeKey === "custom" && from && to ? `${fmtDayShort(from)} – ${fmtDayShort(to)}` : "Période";

  return (
    <div
      ref={rootRef}
      className="relative inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5"
    >
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => nav(p.key === "all" ? "/" : `/?range=${p.key}`)}
          className={chip(p.key === activeKey)}
        >
          {p.label}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setOpen((o) => (o === "month" ? null : "month"))}
        className={chip(activeKey === "month")}
      >
        <CalendarDays size={12} />
        <span className="capitalize">{monthLabel}</span>
      </button>

      <button
        type="button"
        onClick={() => setOpen((o) => (o === "custom" ? null : "custom"))}
        className={chip(activeKey === "custom")}
      >
        <CalendarRange size={12} />
        {customLabel}
      </button>

      {open === "month" && (
        <div className={popover}>
          <MonthPicker value={month} onPick={(m) => nav(`/?range=month&month=${m}`)} />
        </div>
      )}

      {open === "custom" && (
        <div className={popover}>
          <DayPicker from={from} to={to} onApply={(f, t) => nav(`/?range=custom&from=${f}&to=${t}`)} />
        </div>
      )}
    </div>
  );
}
