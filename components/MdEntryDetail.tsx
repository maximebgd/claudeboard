import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { MdEntry, MdKind } from "@/lib/mdEntries";
import { formatDate } from "@/lib/claude";
import ConfigEditor from "@/components/ConfigEditor";

/** Détail + éditeur partagé pour une entrée agents/commandes. */
export default function MdEntryDetail({
  kind,
  entry,
  backHref,
  backLabel,
}: {
  kind: MdKind;
  entry: MdEntry;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft size={15} /> {backLabel}
      </Link>

      <div className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{entry.name}</h1>
          <code className="text-xs text-[var(--color-muted)] bg-[var(--color-code)] rounded px-2 py-0.5">
            {entry.slug}
          </code>
        </div>
        {entry.description && (
          <p className="mt-2 text-sm text-[var(--color-muted)]">{entry.description}</p>
        )}
        <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
          {entry.path} · modifié le {formatDate(entry.updatedAt)}
        </p>
      </div>

      <ConfigEditor
        endpoint="/api/md"
        payload={{ kind, slug: entry.slug }}
        initialRaw={entry.raw}
        mode="markdown"
        label={entry.path.split("/").slice(-2).join("/")}
        exists
      />
    </div>
  );
}
