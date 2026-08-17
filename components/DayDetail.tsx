"use client";

import { useMemo } from "react";
import type { HeatDay } from "./ActivityHeatmap";
import { useTranslation } from "@/components/I18nProvider";
import { tPlural } from "@/lib/i18n/core";
import { makeFormatters } from "@/lib/format";
import type { Language } from "@/lib/i18n/core";

/**
 * Panneau de détail d'un jour (colonne de droite), partagé par la heatmap et la
 * courbe d'activité : sessions/messages, coût estimé et répartition par modèle du
 * jour survolé (ou épinglé).
 */

export interface DetailCell {
  key: string; // YYYY-MM-DD
  data?: HeatDay;
}

function fmtDayLong(date: string, locale: Language): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function DayDetail({ display }: { display: DetailCell | null }) {
  const { t, locale } = useTranslation();
  const fmt = useMemo(() => makeFormatters(locale), [locale]);
  return (
    <div className="flex-1 min-w-[220px] rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] p-4">
      {display ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium capitalize text-[var(--color-fg)]">{fmtDayLong(display.key, locale)}</div>
            {display.data && display.data.messages > 0 && (
              <div className="text-xs text-[var(--color-muted)]">
                {tPlural(t, "dash.session", display.data.sessions)} ·{" "}
                {tPlural(t, "common.message", display.data.messages)}
              </div>
            )}
          </div>
          {display.data && display.data.messages > 0 ? (
            <>
              <div className="mt-3 text-xs">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="text-[var(--color-muted)]">{t("cost.estimated")}</span>
                  <span className="tabular-nums font-medium text-[var(--color-fg)]">{fmt.usd(display.data.costUSD)}</span>
                </div>
                <div className="mt-0.5 text-[var(--color-faint)]">{t("dash.indicativePricing")}</div>
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
            <div className="mt-1 text-xs text-[var(--color-faint)]">{t("dayDetail.noActivity")}</div>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-center text-xs text-[var(--color-faint)]">
          {t("dayDetail.hint")}
        </div>
      )}
    </div>
  );
}
