import { Trash2 } from "lucide-react";
import { listTrash } from "@/lib/trash";
import { getPermissions } from "@/lib/store";
import { formatRelative } from "@/lib/claude";
import TrashList, { type TrashRow } from "@/components/TrashList";
import PermissionNotice from "@/components/PermissionNotice";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const [entries, permissions] = await Promise.all([listTrash(), getPermissions()]);
  const canEmpty = permissions.trash?.empty === true;

  const rows: TrashRow[] = entries.map((e) => ({
    id: e.id,
    label: e.label,
    scope: e.scope,
    originalPath: e.originalPath,
    kind: e.kind,
    restorable: e.restorable,
    // Si tu pouvais le supprimer, tu peux annuler la suppression.
    canRestore: Boolean(
      (permissions as Record<string, Record<string, boolean>>)[e.resource]?.delete
    ),
    deletedLabel: formatRelative(e.deletedAt),
  }));

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Trash2 size={22} className="text-[var(--color-accent)]" />
        Corbeille
      </h1>
      <p className="mt-1 mb-6 text-sm text-[var(--color-muted)]">
        Éléments supprimés depuis claudeboard (skills, agents, commandes, projets, sessions,
        fichiers de config). Ils sont conservés hors de{" "}
        <code className="font-mono text-[12px]">~/.claude</code>, dans{" "}
        <code className="font-mono text-[12px]">data/trash/</code> — restaurables tant que la
        corbeille n'est pas vidée.
      </p>

      {!canEmpty && (
        <PermissionNotice>
          Le vidage de la corbeille est verrouillé. La restauration reste possible si la
          suppression de la ressource concernée est autorisée.
        </PermissionNotice>
      )}

      <TrashList entries={rows} canEmpty={canEmpty} />
    </div>
  );
}
