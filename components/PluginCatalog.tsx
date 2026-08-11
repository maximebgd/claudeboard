"use client";

import { useMemo, useState } from "react";
import { Search, CheckCircle2, Ban, ExternalLink } from "lucide-react";
import type { MarketplacePluginEntry } from "@/lib/plugins";

function PluginRow({ p }: { p: MarketplacePluginEntry }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">{p.name}</span>
        {p.category && (
          <span className="rounded bg-[var(--color-code)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
            {p.category}
          </span>
        )}
        {p.installed && (
          <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
            <CheckCircle2 size={10} /> installé
          </span>
        )}
        {p.blocked && (
          <span
            title={p.blockReason ?? undefined}
            className="flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400"
          >
            <Ban size={10} /> bloqué
          </span>
        )}
        {p.author && (
          <span className="text-[11px] text-[var(--color-faint)]">par {p.author}</span>
        )}
      </div>
      {p.description && (
        <p className="mt-1.5 text-xs text-[var(--color-muted)] line-clamp-3">{p.description}</p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--color-faint)]">
        {p.sourceLabel && <span className="break-all">{p.sourceLabel}</span>}
        {p.homepage && (
          <a
            href={p.homepage}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[var(--color-accent)] hover:underline"
          >
            <ExternalLink size={10} /> homepage
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Catalogue de plugins d'une marketplace : recherche + zone scrollable qui
 * n'affiche qu'environ 4 plugins à la fois (le reste est accessible au scroll).
 */
export default function PluginCatalog({ plugins }: { plugins: MarketplacePluginEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter((p) =>
      [p.name, p.description, p.category, p.author]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(q))
    );
  }, [plugins, query]);

  return (
    <div className="pt-1">
      <div className="relative mb-2">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un plugin…"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 py-3 text-xs text-[var(--color-faint)]">Aucun plugin ne correspond.</p>
      ) : (
        <div className="max-h-[22rem] overflow-y-auto flex flex-col gap-2 pr-1">
          {filtered.map((p) => (
            <PluginRow key={p.name} p={p} />
          ))}
        </div>
      )}

      <div className="mt-1.5 px-1 text-[10px] text-[var(--color-faint)]">
        {filtered.length} / {plugins.length} plugin{plugins.length > 1 ? "s" : ""}
      </div>
    </div>
  );
}
