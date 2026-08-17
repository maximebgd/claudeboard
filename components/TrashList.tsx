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
import { useTranslation } from "@/components/I18nProvider";
import { tPlural } from "@/lib/i18n/core";
import type { TranslationKey } from "@/lib/i18n/core";

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

const SCOPE_LABEL_KEY: Record<string, TranslationKey> = {
  skill: "trash.scope.skill",
  agent: "trash.scope.agent",
  command: "trash.scope.command",
  project: "trash.scope.project",
  session: "trash.scope.session",
  config: "trash.scope.config",
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
  const { t } = useTranslation();
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
      if (!res.ok) throw new Error(data.error || t("trash.opFailed"));
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
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
          {entries.length === 0 ? t("trash.isEmpty") : tPlural(t, "trash.count", entries.length)}
        </p>
        <button
          onClick={() => {
            if (!canEmpty || entries.length === 0) return;
            setError(null);
            setConfirm({ kind: "empty" });
          }}
          aria-disabled={!canEmpty || entries.length === 0 || undefined}
          title={!canEmpty ? t("lockedHint") : undefined}
          className={`flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 ${
            !canEmpty || entries.length === 0
              ? "cursor-not-allowed opacity-40"
              : "hover:bg-red-500/10"
          }`}
        >
          <Trash2 size={14} /> {t("trash.emptyBtn")}
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
              ? t("lockedHint")
              : restoreBlocked
                ? t("trash.restoreBlocked")
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
                      {SCOPE_LABEL_KEY[row.scope] ? t(SCOPE_LABEL_KEY[row.scope]) : row.scope}
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
                    {rowBusy ? "…" : t("trash.restore")}
                  </button>
                  <button
                    onClick={() => {
                      if (!canEmpty) return;
                      setError(null);
                      setConfirm({ kind: "delete", row });
                    }}
                    disabled={busy}
                    aria-disabled={!canEmpty || undefined}
                    title={!canEmpty ? t("lockedHint") : t("trash.deletePermanent")}
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
            ? t("trash.deleteTitle", { label: confirm.row.label })
            : t("trash.emptyTitle")
        }
        description={
          confirm?.kind === "delete"
            ? t("trash.deleteDesc")
            : tPlural(t, "trash.emptyDesc", entries.length)
        }
        confirmLabel={confirm?.kind === "delete" ? t("trash.deletePermanent") : t("trash.emptyConfirm")}
        busy={busy}
        onCancel={() => (busy ? undefined : setConfirm(null))}
        onConfirm={confirmAction}
      />
    </div>
  );
}
