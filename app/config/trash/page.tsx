import { Trash2 } from "lucide-react";
import { listTrash } from "@/lib/trash";
import { getPermissions } from "@/lib/store";
import { formatRelative } from "@/lib/claude";
import TrashList, { type TrashRow } from "@/components/TrashList";
import PermissionNotice from "@/components/PermissionNotice";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const [entries, permissions, { t, locale }] = await Promise.all([
    listTrash(),
    getPermissions(),
    getT(),
  ]);
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
    deletedLabel: formatRelative(e.deletedAt, locale),
  }));

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Trash2 size={22} className="text-[var(--color-accent)]" />
        {t("sidebar.trash")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-[var(--color-muted)]">
        {t("trash.subtitleA")}{" "}
        <code className="font-mono text-[12px]">~/.claude</code>{t("trash.subtitleB")}{" "}
        <code className="font-mono text-[12px]">data/trash/</code> {t("trash.subtitleC")}
      </p>

      {!canEmpty && <PermissionNotice>{t("trash.emptyLocked")}</PermissionNotice>}

      <TrashList entries={rows} canEmpty={canEmpty} />
    </div>
  );
}
