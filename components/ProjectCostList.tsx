"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from "lucide-react";

/**
 * Liste « Coût estimé par projet » du dashboard : recherche par nom + tri
 * croissant/décroissant (décroissant par défaut). La zone de barres affiche
 * ~7 lignes puis devient scrollable. Les barres restent comparables entre elles
 * (largeur relative au projet le plus coûteux, toutes lignes confondues).
 */

export interface ProjectCost {
  id: string;
  label: string;
  costUSD: number;
}

function fmtUSD(n: number): string {
  if (n > 0 && n < 0.01) return "< 0,01 $";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export default function ProjectCostList({ projects }: { projects: ProjectCost[] }) {
  const [query, setQuery] = useState("");
  const [desc, setDesc] = useState(true);

  const maxCost = useMemo(
    () => Math.max(1e-9, ...projects.map((p) => p.costUSD)),
    [projects],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? projects.filter((p) => p.label.toLowerCase().includes(q)) : projects;
    return [...filtered].sort((a, b) => (desc ? b.costUSD - a.costUSD : a.costUSD - b.costUSD));
  }, [projects, query, desc]);

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un projet…"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] py-1.5 pl-8 pr-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setDesc((d) => !d)}
          className="flex shrink-0 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-1.5 text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          title={desc ? "Coût décroissant" : "Coût croissant"}
          aria-label={desc ? "Coût décroissant" : "Coût croissant"}
        >
          {desc ? <ArrowDownWideNarrow size={16} /> : <ArrowUpNarrowWide size={16} />}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Aucun projet ne correspond.</p>
      ) : (
        <div className="flex max-h-[13rem] flex-col gap-2 overflow-y-auto pr-1">
          {visible.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${encodeURIComponent(p.id)}`}
              className="group flex items-center gap-3"
            >
              <span
                className="w-44 shrink-0 truncate text-sm transition-colors group-hover:text-[var(--color-accent)]"
                title={p.label}
              >
                {p.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-inset)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  style={{ width: `${(p.costUSD / maxCost) * 100}%` }}
                />
              </div>
              <span className="w-20 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                {fmtUSD(p.costUSD)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
