import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { MdEntry, MdKind } from "@/lib/mdEntries";
import { formatDate } from "@/lib/claude";
import ConfigEditor from "@/components/ConfigEditor";
import DeleteButton from "@/components/DeleteButton";

/** Détail + éditeur partagé pour une entrée agents/commandes. */
export default function MdEntryDetail({
  kind,
  entry,
  backHref,
  backLabel,
  canWrite = true,
  canDelete = false,
}: {
  kind: MdKind;
  entry: MdEntry;
  backHref: string;
  backLabel: string;
  /** false → édition verrouillée (permission agents/commands.modify désactivée). */
  canWrite?: boolean;
  /** true → affiche la suppression (permission agents/commands.delete accordée). */
  canDelete?: boolean;
}) {
  const what = kind === "agents" ? "agents" : "commandes";
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
        canWrite={canWrite}
        lockedLabel={`Modification des ${what} verrouillée.`}
        rightActions={
          canDelete && (
            <DeleteButton
              endpoint="/api/md"
              body={{ kind, slug: entry.slug }}
              label={`Supprimer ${kind === "agents" ? "l'agent" : "la commande"}`}
              title={`Supprimer ${kind === "agents" ? "l'agent" : "la commande"} « ${entry.name} » ?`}
              description="Le fichier est déplacé dans la corbeille de claudeboard (.claudeboard-trash) — réversible à la main."
              confirmLabel="Supprimer"
              redirectTo={backHref}
              detail={
                <div className="rounded-lg bg-[var(--color-inset)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
                  {kind}/<span className="text-[var(--color-fg)]">{entry.slug}</span>.md
                </div>
              }
            />
          )
        }
      />
    </div>
  );
}
