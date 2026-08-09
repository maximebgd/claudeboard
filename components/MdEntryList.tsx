import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MdEntryMeta } from "@/lib/mdEntries";
import { formatDate } from "@/lib/claude";

/**
 * Liste partagée agents/commandes. Rendu côté serveur : reçoit les entrées et
 * le préfixe de route (ex. "/config/agents"). Les slugs peuvent contenir des
 * "/" (namespaces) → encodage segment par segment pour l'URL catch-all.
 */
export default function MdEntryList({
  entries,
  basePath,
  emptyLabel,
}: {
  entries: MdEntryMeta[];
  basePath: string;
  emptyLabel: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {entries.map((e) => {
        const href = `${basePath}/${e.slug.split("/").map(encodeURIComponent).join("/")}`;
        return (
          <Link
            key={e.slug}
            href={href}
            className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-accent)]/50 transition-colors flex items-start gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.name}</span>
                <code className="text-[11px] text-[var(--color-muted)] bg-[var(--color-code)] rounded px-1.5 py-0.5">
                  {e.slug}
                </code>
                {e.namespace && (
                  <span className="rounded bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
                    {e.namespace}
                  </span>
                )}
              </div>
              {e.description && (
                <p className="mt-1.5 text-sm text-[var(--color-muted)] line-clamp-2">
                  {e.description}
                </p>
              )}
              <p className="mt-2 text-[11px] text-[var(--color-faint)]">
                Modifié le {formatDate(e.updatedAt)}
              </p>
            </div>
            <ChevronRight
              size={18}
              className="text-[var(--color-faint)] group-hover:text-[var(--color-fg)] shrink-0 mt-1"
            />
          </Link>
        );
      })}
    </div>
  );
}
