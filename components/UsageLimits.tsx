"use client";

import { useEffect, useState } from "react";
import { Gauge, Timer, Clock3, CalendarRange, Loader2 } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";
import type { Language } from "@/lib/store";

/** Vue sérialisable d'une fenêtre de limite (miroir de `UsageWindow` côté lib). */
export interface UsageWindowView {
  usedPct: number;
  resetsAt: number;
  expired: boolean;
}

export interface UsageLimitsProps {
  known: boolean;
  fiveHour: UsageWindowView;
  sevenDay: UsageWindowView;
}

/** Couleur de la jauge selon le taux de consommation (vert → ambre → rouge). */
function barColor(pct: number): string {
  if (pct >= 80) return "#e5484d"; // danger
  if (pct >= 50) return "#e0a23b"; // warn
  return "#6bbf73"; // ok
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
    return en ? `${d}d ${rh}h` : `${d} j ${rh} h`;
  }
  if (h >= 1) {
    const rm = min % 60;
    return `${h} h ${rm.toString().padStart(2, "0")}`;
  }
  if (min >= 1) return en ? `${min}m` : `${min} min`;
  return en ? "<1m" : "< 1 min";
}

function Bar({
  icon: Icon,
  label,
  win,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  win: UsageWindowView;
}) {
  const { t, locale } = useTranslation();
  // Horloge locale rafraîchie chaque minute → le reste-à-courir reste vivant sans
  // recharger la page. `null` tant que le composant n'est pas monté : le serveur ne
  // connaît pas l'heure du client, et sémer avec une valeur bidon afficherait un
  // décompte faux (avec `resetsAt`, `remaining` valait 0 → « réinitialisée » à chaque
  // chargement de page). On rend un spinner pendant ce laps — identique côté SSR et
  // au premier rendu client, donc pas de mismatch d'hydratation.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const pct = Math.round(win.usedPct);
  const remaining = now !== null && win.resetsAt > 0 ? win.resetsAt - now : 0;
  const color = barColor(pct);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)]/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <Icon size={14} className="text-[var(--color-accent)]" />
          {label}
        </span>
        <span className="font-mono text-lg font-medium tabular-nums" style={{ color }}>
          {pct}
          <span className="text-[var(--color-faint)] text-sm">%</span>
        </span>
      </div>

      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[var(--color-inset)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, backgroundColor: color }}
        />
      </div>

      {/* `min-h-4` verrouille la hauteur de la ligne : le spinner (11 px) et le texte
          (mono 11 px, interligne ~13 px) n'ont pas la même hauteur naturelle, et la carte
          sautait de 1 px au passage de l'un à l'autre. */}
      <div className="mt-2 flex min-h-4 items-center gap-1.5 font-mono text-[11px] leading-none text-[var(--color-faint)]">
        <Timer size={12} className="shrink-0" />
        {win.resetsAt <= 0 ? (
          <span>{t("usage.noReset")}</span>
        ) : win.expired ? (
          // `expired` vient du serveur (comparaison faite au rendu) : fiable sans horloge.
          <span>{t("usage.resetNow")}</span>
        ) : now === null ? (
          <span className="inline-flex items-center">
            <Loader2 size={11} className="animate-spin" aria-hidden />
            <span className="sr-only">{t("usage.loading")}</span>
          </span>
        ) : remaining <= 0 ? (
          <span>{t("usage.resetNow")}</span>
        ) : (
          <span>{t("usage.resetIn", { duration: formatCountdown(remaining, locale) })}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Deux barres de limites d'usage Claude.ai (fenêtres 5 h et 7 j), lues du cache du
 * statusline (`lib/rateLimits.ts`). Silencieux si l'info n'est pas disponible.
 */
export default function UsageLimits({ known, fiveHour, sevenDay }: UsageLimitsProps) {
  const { t } = useTranslation();
  if (!known) return null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
        <Gauge size={13} className="text-[var(--color-accent)]" />
        <h2 className="eyebrow text-[var(--color-muted)]">{t("usage.title")}</h2>
        <span className="ml-auto font-mono text-[10px] text-[var(--color-faint)]">{t("usage.hint")}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Bar icon={Clock3} label={t("usage.fiveHour")} win={fiveHour} />
        <Bar icon={CalendarRange} label={t("usage.sevenDay")} win={sevenDay} />
      </div>
    </div>
  );
}
