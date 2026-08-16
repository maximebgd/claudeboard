"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Undo2,
  Sparkles,
  Bot,
  SquareSlash,
  FolderGit2,
  MessageSquare,
  Settings,
  File,
  type LucideIcon,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { LOCKED_HINT } from "./lockedHint";

export interface TrashRow {
  id: string;
  label: string;
  scope: string;
  originalPath: string;
  kind: "file" | "dir";
  /** La cible d'origine est libre (pas de conflit). */
  restorable: boolean;
  /** La permission `delete` de la ressource d'origine est accordée. */
  canRestore: boolean;
  /** Ancienneté pré-formatée (ex. « il y a 2 h »). */
  deletedLabel: string;
}

const SCOPE_LABEL: Record<string, string> = {
  skill: "Skill",
  agent: "Agent",
  command: "Commande",
  project: "Projet",
  session: "Session",
  config: "Config",
};

// Icône par type d'élément (alignée sur la Sidebar), plutôt que fichier/dossier.
const SCOPE_ICON: Record<string, LucideIcon> = {
  skill: Sparkles,
  agent: Bot,
  command: SquareSlash,
  project: FolderGit2,
  session: MessageSquare,
  config: Settings,
};

export default function TrashList({
  entries,
  canEmpty,
}: {
  entries: TrashRow[];
  canEmpty: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "empty" } | { kind: "delete"; row: TrashRow }>(
    null
  );

  async function post(body: Record<string, unknown>, busyKey: string): Promise<boolean> {
    setBusyId(busyKey);
    setError(null);
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'opération");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function restore(row: TrashRow) {
    if (!row.restorable || !row.canRestore) return;
    await post({ op: "restore", id: row.id }, row.id);
  }

  async function confirmAction() {
    if (!confirm) return;
    if (confirm.kind === "empty") {
      if (await post({ op: "empty" }, "__empty__")) setConfirm(null);
    } else {
      if (await post({ op: "delete", id: confirm.row.id }, confirm.row.id)) setConfirm(null);
    }
  }

  const busy = busyId !== null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]">
          {entries.length === 0
            ? "La corbeille est vide."
            : `${entries.length} élément${entries.length > 1 ? "s" : ""} supprimé${
                entries.length > 1 ? "s" : ""
              }.`}
        </p>
        <button
          onClick={() => {
            if (!canEmpty || entries.length === 0) return;
            setError(null);
            setConfirm({ kind: "empty" });
          }}
          aria-disabled={!canEmpty || entries.length === 0 || undefined}
          title={!canEmpty ? LOCKED_HINT : undefined}
          className={`flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 ${
            !canEmpty || entries.length === 0
              ? "cursor-not-allowed opacity-40"
              : "hover:bg-red-500/10"
          }`}
        >
          <Trash2 size={14} /> Vider la corbeille
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.map((row) => {
            const restoreLocked = !row.canRestore;
            const restoreBlocked = !row.restorable;
            const restoreTitle = restoreLocked
              ? LOCKED_HINT
              : restoreBlocked
                ? "Un élément porte déjà ce nom à l'emplacement d'origine — supprimez ou renommez la cible avant de restaurer."
                : undefined;
            const rowBusy = busyId === row.id;
            const Icon = SCOPE_ICON[row.scope] ?? File;
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3"
              >
                <span className="text-[var(--color-muted)]">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{row.label}</span>
                    <span className="shrink-0 rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] text-[var(--color-muted)]">
                      {SCOPE_LABEL[row.scope] ?? row.scope}
                    </span>
                  </div>
                  <div className="truncate font-mono text-[11px] text-[var(--color-faint)]">
                    {row.originalPath}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-[var(--color-muted)]">{row.deletedLabel}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => restore(row)}
                    disabled={busy}
                    aria-disabled={restoreLocked || restoreBlocked || undefined}
                    title={restoreTitle}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm ${
                      restoreLocked || restoreBlocked
                        ? "cursor-not-allowed border-[var(--color-border)] text-[var(--color-faint)] opacity-60"
                        : "border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                    } disabled:opacity-40`}
                  >
                    <Undo2 size={14} />
                    {rowBusy ? "…" : "Restaurer"}
                  </button>
                  <button
                    onClick={() => {
                      if (!canEmpty) return;
                      setError(null);
                      setConfirm({ kind: "delete", row });
                    }}
                    disabled={busy}
                    aria-disabled={!canEmpty || undefined}
                    title={!canEmpty ? LOCKED_HINT : "Supprimer définitivement"}
                    className={`flex items-center rounded-lg border border-red-500/40 p-1.5 text-red-400 ${
                      !canEmpty ? "cursor-not-allowed opacity-40" : "hover:bg-red-500/10"
                    } disabled:opacity-40`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === "delete"
            ? `Supprimer « ${confirm.row.label} » définitivement ?`
            : "Vider la corbeille ?"
        }
        description={
          confirm?.kind === "delete"
            ? "Cette entrée sera supprimée définitivement — cette action est irréversible."
            : `Les ${entries.length} élément${entries.length > 1 ? "s" : ""} de la corbeille seront supprimés définitivement — cette action est irréversible.`
        }
        confirmLabel={confirm?.kind === "delete" ? "Supprimer définitivement" : "Vider"}
        busy={busy}
        onCancel={() => (busy ? undefined : setConfirm(null))}
        onConfirm={confirmAction}
      />
    </div>
  );
}
