"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X, Check } from "lucide-react";
import Markdown from "./Markdown";
import ConfirmDialog from "./ConfirmDialog";
import { useTranslation } from "@/components/I18nProvider";

interface Props {
  slug: string;
  initialRaw: string;
  content: string; // corps markdown (pour l'aperçu en lecture)
  /** false → bouton « Éditer » grisé et inopérant (permission skills.modify désactivée). */
  canWrite?: boolean;
  /** Éléments à afficher à droite dans la barre d'actions. */
  rightActions?: React.ReactNode;
}

export default function SkillEditor({ slug, initialRaw, content, canWrite = true, rightActions }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialRaw);
  const [savedRaw, setSavedRaw] = useState(initialRaw);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const dirty = draft !== savedRaw;

  // Le SKILL.md peut changer côté serveur pendant que ce composant reste monté —
  // typiquement après une restauration depuis le panneau Versions, qui appelle
  // `router.refresh()` et renvoie un nouvel `initialRaw`. On resynchronise alors
  // l'aperçu, sauf si l'utilisateur est en train d'éditer (on ne veut pas écraser son
  // brouillon en cours).
  useEffect(() => {
    if (editing) return;
    setSavedRaw(initialRaw);
    setDraft(initialRaw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRaw]);

  async function doSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, raw: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.writeFailed"));
      setSavedRaw(draft);
      setConfirmOpen(false);
      setEditing(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 2500);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={() => {
                if (!canWrite) return;
                setDraft(savedRaw);
                setEditing(true);
              }}
              aria-disabled={!canWrite || undefined}
              title={!canWrite ? t("lockedHint") : undefined}
              className={`flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm ${
                canWrite ? "hover:bg-[var(--color-hover)]" : "cursor-not-allowed opacity-40"
              }`}
            >
              <Pencil size={14} /> {t("editor.edit")}
            </button>
          ) : (
            <>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={!dirty}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40"
              >
                <Save size={14} /> {t("editor.save")}
              </button>
              <button
                onClick={() => {
                  setDraft(savedRaw);
                  setEditing(false);
                  setError(null);
                }}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-hover)]"
              >
                <X size={14} /> {t("common.cancel")}
              </button>
              {dirty && <span className="text-xs text-amber-400">{t("editor.unsaved")}</span>}
            </>
          )}
          {flash && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check size={14} /> {t("editor.savedBackup")}
            </span>
          )}
        </div>
        {rightActions && <div className="flex items-center gap-2">{rightActions}</div>}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="w-full min-h-[60vh] rounded-xl border border-[var(--color-border)] bg-[var(--color-inset)] p-4 font-mono text-[13px] leading-relaxed text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]/50"
        />
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
          <Markdown>{content}</Markdown>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t("skillEditor.confirmTitle")}
        description={t("skillEditor.confirmDesc", { slug })}
        confirmLabel={t("editor.writeFile")}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doSave}
        detail={
          <div className="rounded-lg bg-[var(--color-inset)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
            skills/<span className="text-[var(--color-fg)]">{slug}</span>/SKILL.md
          </div>
        }
      />
    </div>
  );
}
