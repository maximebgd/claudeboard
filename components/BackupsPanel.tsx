"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, History, RotateCcw, GitCompare } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { useTranslation } from "@/components/I18nProvider";
import { tPlural } from "@/lib/i18n/core";
import { unifiedDiff } from "@/lib/diff";

interface Version {
  id: string;
  savedAt: number;
  size: number;
}

/**
 * Panneau « Versions » replié sous l'éditeur d'un fichier de config. Liste les
 * sauvegardes automatiques (créées à chaque enregistrement, stockées hors de
 * ~/.claude). Chaque version peut être comparée au **contenu actuel** du fichier
 * (`currentRaw`) sous forme de diff unifié façon `git diff`, puis restaurée. La
 * restauration est verrouillée si la permission `modify` de la cible est désactivée
 * (l'API refuse de toute façon).
 */
export default function BackupsPanel({
  target,
  canRestore,
  currentRaw,
}: {
  target: string;
  canRestore: boolean;
  currentRaw: string;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; content: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = `/api/backups?target=${encodeURIComponent(target)}`;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(q);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.unknownError"));
      setVersions(data.versions ?? []);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  }

  async function showPreview(id: string) {
    if (preview?.id === id) {
      setPreview(null);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`${q}&id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.unknownError"));
      setPreview({ id, content: data.content ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
    }
  }

  async function doRestore() {
    if (!confirmId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "restore", target, id: confirmId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.writeFailed"));
      setConfirmId(null);
      setPreview(null);
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  }

  // Diff façon git : du contenu actuel (ancien) vers la version choisie (nouveau).
  // Vert (+) = ce que la restauration ajouterait ; rouge (−) = ce qu'elle retirerait.
  const diff = useMemo(
    () => (preview ? unifiedDiff(currentRaw, preview.content) : null),
    [preview, currentRaw]
  );

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleString(locale === "en" ? "en-US" : "fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtSize = (b: number) =>
    b < 1024 ? `${b} ${locale === "en" ? "B" : "o"}` : `${(b / 1024).toFixed(1)} ${locale === "en" ? "KB" : "Ko"}`;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] overflow-hidden">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-[var(--color-hover)]"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <History size={13} className="text-[var(--color-muted)]" />
        {t("backups.title")}
        {loaded && (
          <span className="text-[var(--color-faint)]">· {tPlural(t, "backups.version", versions.length)}</span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3">
          <p className="mb-2 text-[11px] text-[var(--color-muted)]">{t("backups.subtitle")}</p>

          {error && (
            <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-xs text-[var(--color-faint)]">{t("common.loading")}</p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-[var(--color-faint)]">{t("backups.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]"
                >
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                    <span className="font-mono text-[var(--color-fg)]">{fmtDate(v.savedAt)}</span>
                    <span className="text-[var(--color-faint)]">· {fmtSize(v.size)}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        onClick={() => showPreview(v.id)}
                        className={`flex items-center gap-1 rounded-md border px-2 py-1 ${
                          preview?.id === v.id
                            ? "border-[var(--color-accent)]/50 bg-[var(--color-hover)] text-[var(--color-fg)]"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
                        }`}
                      >
                        <GitCompare size={12} />
                        {t("backups.diff")}
                      </button>
                      <button
                        onClick={() => {
                          if (!canRestore) return;
                          setError(null);
                          setConfirmId(v.id);
                        }}
                        aria-disabled={!canRestore || undefined}
                        title={!canRestore ? t("lockedHint") : undefined}
                        className={`flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 ${
                          canRestore
                            ? "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
                            : "cursor-not-allowed opacity-40"
                        }`}
                      >
                        <RotateCcw size={12} /> {t("backups.restore")}
                      </button>
                    </div>
                  </div>
                  {preview?.id === v.id && diff && (
                    <div className="border-t border-[var(--color-border)]">
                      <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] text-[var(--color-muted)]">
                        <span>{t("backups.diffCaption")}</span>
                        <span className="ml-auto font-mono">
                          <span className="text-emerald-400">+{diff.added}</span>{" "}
                          <span className="text-red-400">−{diff.removed}</span>
                        </span>
                      </div>
                      {diff.lines.length === 0 ? (
                        <p className="px-3 pb-3 text-[11px] text-[var(--color-faint)]">
                          {t("backups.identical")}
                        </p>
                      ) : (
                        <div className="max-h-80 overflow-auto bg-[var(--color-code)] font-mono text-[11px] leading-[1.5]">
                          {diff.lines.map((l, k) => {
                            const prefix = l.kind === "add" ? "+" : l.kind === "del" ? "-" : l.kind === "hunk" ? "" : " ";
                            const cls =
                              l.kind === "add"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : l.kind === "del"
                                  ? "bg-red-500/10 text-red-300"
                                  : l.kind === "hunk"
                                    ? "bg-[var(--color-inset)] text-cyan-400 select-none"
                                    : "text-[var(--color-muted)]";
                            return (
                              <div key={k} className={`whitespace-pre px-3 ${cls}`}>
                                <span className="select-none opacity-60">{prefix}</span>
                                {l.text || " "}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        title={t("backups.confirmTitle")}
        description={t("backups.confirmDesc")}
        confirmLabel={t("backups.restore")}
        busy={busy}
        onCancel={() => setConfirmId(null)}
        onConfirm={doRestore}
      />
    </div>
  );
}
