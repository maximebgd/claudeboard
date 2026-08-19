"use client";

import { useEffect, useState } from "react";
import { Clock3, CalendarRange, Loader2, TriangleAlert } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";
import type { Language } from "@/lib/store";

/**
 * Limites d'usage Claude.ai (fenêtres 5 h / 7 j), lues du cache du statusline
 * (`lib/rateLimits.ts`) et rendues en bandeau compact dans le header du dashboard,
 * à gauche de la ligne qui porte le RangeSelector.
 * Si l'info n'est pas disponible (`known: false`, cache absent car statusline non
 * configuré), le bandeau reste affiché mais avec des jauges vides + une alerte qui
 * renvoie vers la doc de configuration (`/docs/fonctionnalites`).
 */

/** Vue sérialisable d'une fenêtre de limite (miroir de `UsageWindow` côté lib). */
export interface UsageWindowView {
  usedPct: number;
  resetsAt: number;
  expired: boolean;
}

export interface RateLimitsView {
  known: boolean;
  fiveHour: UsageWindowView;
  sevenDay: UsageWindowView;
}

/* ------------------------------- primitives ------------------------------- */

const GREEN = "#6bbf73";
const YELLOW = "#e0a23b";
const ORANGE = "#ff8700"; // xterm 256 · #208
const RED = "#e5484d";
const NEUTRAL = "var(--color-muted)"; // « no color » : remplissage neutre, pas d'alerte

/** Couleur de la jauge 5 h (4 seuils : vert < 25 % → jaune → orange → rouge ≥ 75 %). */
function color5h(pct: number): string {
  if (pct >= 75) return RED;
  if (pct >= 50) return ORANGE;
  if (pct >= 25) return YELLOW;
  return GREEN;
}

/** Couleur de la jauge 7 j (neutre < 60 % → orange → rouge ≥ 80 %). */
function color7d(pct: number): string {
  if (pct >= 80) return RED;
  if (pct >= 60) return ORANGE;
  return NEUTRAL;
}

/** Compte à rebours compact jusqu'au reset (« 1 h 40 » / « 2 j 4 h »). */
function formatCountdown(ms: number, locale: Language): string {
  if (ms <= 0) return "—";
  const en = locale === "en";
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) {
    const rh = h % 24;
    return en ? `${d}d ${rh}h` : `${d}j ${rh}h`;
  }
  if (h >= 1) {
    const rm = min % 60;
    return `${h}h ${rm.toString().padStart(2, "0")}m`;
  }
  if (min >= 1) return en ? `${min}m` : `${min} min`;
  return en ? "<1m" : "< 1 min";
}

/**
 * Horloge locale rafraîchie toutes les 30 s → le reste-à-courir reste vivant sans
 * recharger la page. `null` tant que le composant n'est pas monté : le serveur ne
 * connaît pas l'heure du client, et sémer avec une valeur bidon afficherait un
 * décompte faux. Les variants rendent un spinner pendant ce laps — identique côté
 * SSR et au premier rendu client, donc pas de mismatch d'hydratation.
 */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

type ResetState =
  | { kind: "none" }
  | { kind: "now" }
  | { kind: "loading" }
  | { kind: "in"; remaining: number };

/** Ce qu'il faut afficher pour une fenêtre, selon son epoch de reset et l'horloge. */
function resetState(win: UsageWindowView, now: number | null): ResetState {
  if (win.resetsAt <= 0) return { kind: "none" };
  // `expired` vient du serveur (comparaison faite au rendu) : fiable sans horloge.
  if (win.expired) return { kind: "now" };
  if (now === null) return { kind: "loading" };
  const remaining = win.resetsAt - now;
  return remaining <= 0 ? { kind: "now" } : { kind: "in", remaining };
}

/** Libellé de reset, spinner compris. Les conteneurs figent la hauteur (min-h). */
function ResetText({ st, spinner = 10 }: { st: ResetState; spinner?: number }) {
  const { t, locale } = useTranslation();
  if (st.kind === "none") return <span>{t("usage.noReset")}</span>;
  if (st.kind === "now") return <span>{t("usage.resetNow")}</span>;
  if (st.kind === "loading")
    return (
      <span className="inline-flex items-center">
        <Loader2 size={spinner} className="animate-spin" aria-hidden />
        <span className="sr-only">{t("usage.loading")}</span>
      </span>
    );
  return <span>{t("usage.resetIn", { duration: formatCountdown(st.remaining, locale) })}</span>;
}

/** Jauge horizontale nue (le `pct > 0` garantit un liseré visible à 1 %). */
function Gauge({ pct, color, className }: { pct: number; color: string; className: string }) {
  return (
    <span className={`block overflow-hidden rounded-full bg-[var(--color-border)] ${className}`}>
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, backgroundColor: color }}
      />
    </span>
  );
}

/* --------------------------- variant « bandeau » -------------------------- */

function BannerItem({
  icon: Icon,
  label,
  win,
  now,
  colorOf,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  win: UsageWindowView;
  now: number | null;
  colorOf: (pct: number) => string;
}) {
  const pct = Math.round(win.usedPct);
  const color = colorOf(pct);
  return (
    <span className="inline-flex min-h-4 items-center gap-2">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[var(--color-muted)]">
        <Icon size={12} className="shrink-0 text-[var(--color-accent)]" />
        {label}
      </span>
      <Gauge pct={pct} color={color} className="h-1.5 w-16 shrink-0" />
      <span className="shrink-0 tabular-nums" style={{ color }}>
        {pct}%
      </span>
      <span aria-hidden className="text-[var(--color-faint)]">
        ·
      </span>
      {/* `min-w` réserve la place du plus long libellé : le passage spinner → texte
          ne décale pas l'item suivant du bandeau. */}
      <span className="inline-flex min-w-[7rem] items-center text-[var(--color-faint)]">
        <ResetText st={resetState(win, now)} />
      </span>
    </span>
  );
}

/** Item « non renseigné » : jauge vide et muette, quand le cache n'existe pas. */
function UnconfiguredItem({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex min-h-4 items-center gap-2 opacity-60">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[var(--color-muted)]">
        <Icon size={12} className="shrink-0 text-[var(--color-faint)]" />
        {label}
      </span>
      <Gauge pct={0} color="transparent" className="h-1.5 w-16 shrink-0" />
      <span className="shrink-0 tabular-nums text-[var(--color-faint)]">—</span>
    </span>
  );
}

/** Bandeau « status line » : une ligne, à gauche du RangeSelector dans le header. */
export function UsageBanner({ known, fiveHour, sevenDay }: RateLimitsView) {
  const { t } = useTranslation();
  const now = useNow();

  // Cache absent (statusline non configuré) : on garde les deux jauges, vides, et on
  // renvoie vers la doc de configuration via une alerte cliquable.
  if (!known) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] leading-none">
        <UnconfiguredItem icon={Clock3} label={t("usage.short5h")} />
        <UnconfiguredItem icon={CalendarRange} label={t("usage.short7d")} />
        <a
          href={`/docs/fonctionnalites#${t("usage.docsAnchor")}`}
          title={t("usage.notConfiguredHint")}
          className="inline-flex items-center gap-1.5 hover:underline"
          style={{ color: "#e0a23b" }}
        >
          <TriangleAlert size={12} className="shrink-0" aria-hidden />
          <span>{t("usage.notConfigured")}</span>
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] leading-none">
      <BannerItem icon={Clock3} label={t("usage.short5h")} win={fiveHour} now={now} colorOf={color5h} />
      <BannerItem
        icon={CalendarRange}
        label={t("usage.short7d")}
        win={sevenDay}
        now={now}
        colorOf={color7d}
      />
    </div>
  );
}
