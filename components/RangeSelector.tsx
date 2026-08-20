"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";
import type { Language } from "@/lib/i18n/core";
import { billingCycle, recentCycles } from "@/lib/billingCycle";

/**
 * Sélecteur de fenêtre temporelle du dashboard. Presets rapides (Tout / 30 j / 7 j)
 * + deux modes ouverts via popover, avec un calendrier maison (pas de picker natif) :
 * un mois précis (`?range=month&month=YYYY-MM`) et une période personnalisée
 * (`?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`). Le composant ne fait que naviguer ;
 * la résolution en bornes epoch se fait côté page.
 */

const PRESET_KEYS = ["all", "30j", "7j"] as const;

const bcp = (locale: Language) => (locale === "en" ? "en-US" : "fr-FR");

const MONTHS_SHORT_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
const MONTHS_SHORT_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS_FR = ["lu", "ma", "me", "je", "ve", "sa", "di"];
const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthsShort = (l: Language) => (l === "en" ? MONTHS_SHORT_EN : MONTHS_SHORT_FR);
const weekdays = (l: Language) => (l === "en" ? WEEKDAYS_EN : WEEKDAYS_FR);

export interface RangeSelectorProps {
  activeKey: string;
  /** YYYY-MM (préremplissage du mode « Mois »). */
  month: string;
  /** YYYY-MM-DD (préremplissage du mode « Période »). */
  from: string;
  to: string;
  /** Offset du cycle de facturation actif (0 = courant), "" hors mode cycle. */
  cycle: string;
  /** Date de souscription (ms) : ancre des cycles ; `null` masque le chip « Cycle ». */
  anchorMs: number | null;
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

function fmtMonthLabel(m: string, locale: Language, fallback: string): string {
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return fallback;
  return new Date(y, mo - 1, 1).toLocaleDateString(bcp(locale), { month: "long", year: "numeric" });
}

function fmtDayShort(d: string, locale: Language): string {
  const [y, m, day] = d.split("-").map(Number);
  if (!y) return d;
  return new Date(y, m - 1, day).toLocaleDateString(bcp(locale), { day: "numeric", month: "short" });
}

/** « 23 juil. » à partir d'un epoch ms, en UTC (bornes de cycle calées UTC). */
function fmtMsDay(ms: number, locale: Language): string {
  return new Date(ms).toLocaleDateString(bcp(locale), { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Libellé « 23 juil. – 23 août » d'un cycle : la borne de fin affichée est le début
 * du cycle suivant (`endMs + 1`), pour lire « du 23 au 23 » comme la facturation.
 */
function fmtCycleSpan(startMs: number, endMs: number, locale: Language): string {
  return `${fmtMsDay(startMs, locale)} – ${fmtMsDay(endMs + 1, locale)}`;
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

function MonthPicker({
  value,
  onPick,
  locale,
  t,
}: {
  value: string;
  onPick: (m: string) => void;
  locale: Language;
  t: (key: "range.prevYear" | "range.nextYear") => string;
}) {
  const now = new Date();
  const [vy] = value.split("-").map(Number);
  const [year, setYear] = useState(vy || now.getFullYear());
  const curY = now.getFullYear();
  const curM = now.getMonth();

  return (
    <div className="w-56">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navBtn} onClick={() => setYear((y) => y - 1)} aria-label={t("range.prevYear")}>
          <ChevronLeft size={15} />
        </button>
        <span className="font-mono text-sm font-medium tabular-nums">{year}</span>
        <button
          type="button"
          className={navBtn}
          onClick={() => setYear((y) => Math.min(curY, y + 1))}
          disabled={year >= curY}
          aria-label={t("range.nextYear")}
        >
          <ChevronRight size={15} className={year >= curY ? "opacity-30" : ""} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {monthsShort(locale).map((label, i) => {
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
  locale,
  t,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  locale: Language;
  t: (key: "range.apply" | "range.prevMonth" | "range.nextMonth") => string;
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

  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString(bcp(locale), { month: "long", year: "numeric" });

  return (
    <div className="w-64">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navBtn} onClick={() => shift(-1)} aria-label={t("range.prevMonth")}>
          <ChevronLeft size={15} />
        </button>
        <span className="font-mono text-sm font-medium capitalize tabular-nums">{monthLabel}</span>
        <button type="button" className={navBtn} onClick={() => shift(1)} aria-label={t("range.nextMonth")}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {weekdays(locale).map((w) => (
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
          {start ? fmtDayShort(start, locale) : "…"} → {end ? fmtDayShort(end, locale) : "…"}
        </span>
        <button
          type="button"
          onClick={() => start && end && onApply(start, end)}
          disabled={!start || !end}
          className="rounded-md bg-[var(--color-accent)] px-3 py-1 font-mono text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {t("range.apply")}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- CyclePicker ------------------------------ */

function CyclePicker({
  anchorMs,
  activeOffset,
  onPick,
  locale,
  t,
}: {
  anchorMs: number;
  /** Offset actif ("" si le mode cycle n'est pas courant). */
  activeOffset: string;
  onPick: (offset: number) => void;
  locale: Language;
  t: (key: "range.cycleCurrent" | "range.cycleHint") => string;
}) {
  // Jusqu'à 12 cycles récents (courant d'abord), plafonnés à la souscription.
  const cycles = useMemo(() => recentCycles(anchorMs, Date.now(), 12), [anchorMs]);

  return (
    <div className="w-60">
      {/* <div className="mb-2 px-1 text-[11px] leading-snug text-[var(--color-muted)]">{t("range.cycleHint")}</div> */}
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        {cycles.map((c) => {
          const on = activeOffset === String(c.offset);
          return (
            <button
              key={c.offset}
              type="button"
              onClick={() => onPick(c.offset)}
              className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left font-mono text-xs tabular-nums transition-colors ${
                on
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-fg)] hover:bg-[var(--color-hover)]"
              }`}
            >
              <span>{fmtCycleSpan(c.startMs, c.endMs, locale)}</span>
              {c.offset === 0 && (
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
                    on ? "bg-white/20 text-white" : "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                  }`}
                >
                  {t("range.cycleCurrent")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ RangeSelector ----------------------------- */

/** Modes du calendrier regroupés sous l'unique bouton icône. */
type CalMode = "month" | "custom" | "cycle";

export default function RangeSelector({ activeKey, month, from, to, cycle, anchorMs }: RangeSelectorProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  // Onglet actif dans le popover calendrier (recalé sur le mode courant à l'ouverture).
  const calMode: CalMode = activeKey === "custom" ? "custom" : activeKey === "cycle" ? "cycle" : "month";
  const [tab, setTab] = useState<CalMode>(calMode);
  const rootRef = useRef<HTMLDivElement>(null);

  const PRESETS = PRESET_KEYS.map((key) => ({
    key,
    label: key === "all" ? t("range.all") : key === "30j" ? t("range.30d") : t("range.7d"),
  }));

  // Ferme le popover au clic extérieur ou sur Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const nav = (href: string) => {
    setOpen(false);
    router.push(href, { scroll: false });
  };

  // Ouvre le popover en recalant l'onglet sur le mode actuellement sélectionné.
  const toggle = () =>
    setOpen((o) => {
      if (!o) setTab(calMode);
      return !o;
    });

  const calActive = activeKey === "month" || activeKey === "custom" || activeKey === "cycle";
  // Libellé compact affiché à côté de l'icône **quand** une plage calendrier est active.
  const activeLabel =
    activeKey === "month"
      ? fmtMonthLabel(month, locale, t("range.month"))
      : activeKey === "custom" && from && to
        ? `${fmtDayShort(from, locale)} – ${fmtDayShort(to, locale)}`
        : activeKey === "cycle" && anchorMs
          ? (() => {
              const c = billingCycle(anchorMs, Math.max(0, Number(cycle) || 0), Date.now());
              return fmtCycleSpan(c.startMs, c.endMs, locale);
            })()
          : null;

  // Onglets disponibles dans le popover (le cycle n'apparaît qu'avec une date d'abo).
  const TABS: { key: CalMode; label: string; Icon: typeof CalendarDays }[] = [
    { key: "month", label: t("range.month"), Icon: CalendarDays },
    { key: "custom", label: t("range.custom"), Icon: CalendarRange },
    ...(anchorMs ? [{ key: "cycle" as const, label: t("range.cycle"), Icon: CalendarClock }] : []),
  ];

  const tabBtn = (on: boolean) =>
    `flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
      on
        ? "bg-[var(--color-accent)] text-white"
        : "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
    }`;

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

      {/* Unique bouton calendrier : mois complet / période libre / cycle d'abonnement. */}
      <button
        type="button"
        onClick={toggle}
        className={chip(calActive)}
        aria-label={t("range.calendar")}
        title={t("range.calendar")}
      >
        <CalendarDays size={13} />
        {activeLabel && <span className="capitalize">{activeLabel}</span>}
      </button>

      {open && (
        <div className={popover}>
          {/* Sélecteur d'onglet : mois / période / cycle. */}
          <div className="mb-3 flex gap-0.5 rounded-md bg-[var(--color-inset)] p-0.5">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={tabBtn(tab === key)}>
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {tab === "month" && (
            <MonthPicker value={month} onPick={(m) => nav(`/?range=month&month=${m}`)} locale={locale} t={t} />
          )}

          {tab === "custom" && (
            <DayPicker
              from={from}
              to={to}
              onApply={(f, tt) => nav(`/?range=custom&from=${f}&to=${tt}`)}
              locale={locale}
              t={t}
            />
          )}

          {tab === "cycle" && anchorMs && (
            <CyclePicker
              anchorMs={anchorMs}
              activeOffset={activeKey === "cycle" ? cycle : ""}
              onPick={(offset) => nav(`/?range=cycle&cycle=${offset}`)}
              locale={locale}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}
