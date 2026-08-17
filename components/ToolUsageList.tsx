"use client";

import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Wrench } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";
import { makeFormatters } from "@/lib/format";

/**
 * Section « Outils & skills les plus utilisés » du dashboard : titre + bouton de
 * tri croissant/décroissant par nombre d'appels (décroissant par défaut) alignés
 * sur une même ligne, puis liste de barres. La zone de barres affiche ~7 lignes
 * puis devient scrollable. Les barres restent comparables (largeur relative à
 * l'outil le plus appelé, toutes lignes confondues).
 */

export interface ToolUsage {
  name: string;
  count: number;
}

export default function ToolUsageList({ tools }: { tools: ToolUsage[] }) {
  const { t, locale } = useTranslation();
  const fmt = useMemo(() => makeFormatters(locale), [locale]);
  const [desc, setDesc] = useState(true);

  const maxCount = useMemo(() => Math.max(1, ...tools.map((t) => t.count)), [tools]);

  const visible = useMemo(
    () => [...tools].sort((a, b) => (desc ? b.count - a.count : a.count - b.count)),
    [tools, desc],
  );

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
        <Wrench size={13} className="text-[var(--color-accent)]" />
        <h2 className="eyebrow text-[var(--color-muted)]">{t("toolUsage.title")}</h2>
        {tools.length > 0 && (
          <button
            type="button"
            onClick={() => setDesc((d) => !d)}
            className="ml-auto flex shrink-0 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-1.5 text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            title={desc ? t("toolUsage.sortDesc") : t("toolUsage.sortAsc")}
            aria-label={desc ? t("toolUsage.sortDesc") : t("toolUsage.sortAsc")}
          >
            {desc ? <ArrowDownWideNarrow size={16} /> : <ArrowUpNarrowWide size={16} />}
          </button>
        )}
      </div>

      {tools.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{t("toolUsage.empty")}</p>
      ) : (
        <div className="flex max-h-[13rem] flex-col gap-2 overflow-y-auto pr-1">
          {visible.map((tool) => (
            <div key={tool.name} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate font-mono text-sm" title={tool.name}>
                {tool.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-inset)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  style={{ width: `${(tool.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                {fmt.num(tool.count)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
