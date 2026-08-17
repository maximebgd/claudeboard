"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "@/components/I18nProvider";
import { tPlural } from "@/lib/i18n/core";

/**
 * Distribution horaire des débuts de session (24 barres, une par heure locale).
 * Style aligné sur l'exemple « Hourly Distribution » : barres accent proportionnelles
 * au pic, repères d'axe à 00 / 06 / 12 / 18 / 23 h, tooltip au survol.
 */

const AXIS_HOURS = [0, 6, 12, 18, 23];

function fmtHour(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

export default function HourlyDistribution({ hours }: { hours: number[] }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(() => Math.max(1, ...hours), [hours]);
  const total = useMemo(() => hours.reduce((a, b) => a + b, 0), [hours]);
  // Heure de pointe (première heure atteignant le max) pour le sous-titre.
  const peak = useMemo(() => (total > 0 ? hours.indexOf(max) : -1), [hours, max, total]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
            <h2 className="eyebrow text-[var(--color-muted)]">{t("hourly.title")}</h2>
          </div>
          <p className="mt-1.5 ml-[11px] text-xs text-[var(--color-faint)]">{t("hourly.subtitle")}</p>
        </div>
        {peak >= 0 && (
          <div className="text-right">
            <div className="font-mono text-sm tabular-nums text-[var(--color-fg)]">
              {hover !== null ? fmtHour(hover) : t("hourly.peak", { hour: fmtHour(peak) })}
            </div>
            <div className="font-mono text-[11px] tabular-nums text-[var(--color-faint)]">
              {hover !== null
                ? tPlural(t, "dash.session", hours[hover])
                : t("hourly.total", { count: total })}
            </div>
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{t("hourly.empty")}</p>
      ) : (
        <>
          <div className="flex h-32 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
            {hours.map((count, h) => {
              const active = hover === null || hover === h;
              return (
                <div
                  key={h}
                  onMouseEnter={() => setHover(h)}
                  className="flex h-full flex-1 cursor-pointer flex-col justify-end"
                  title={`${fmtHour(h)} · ${tPlural(t, "dash.session", count)}`}
                >
                  <div
                    className="w-full rounded-sm bg-[var(--color-accent)] transition-opacity"
                    style={{
                      height: `${Math.max(count > 0 ? 3 : 0, (count / max) * 100)}%`,
                      opacity: active ? 1 : 0.32,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-[3px] text-[10px] text-[var(--color-faint)]">
            {hours.map((_, h) => (
              <div key={h} className="flex-1 text-center">
                {AXIS_HOURS.includes(h) ? fmtHour(h) : ""}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
