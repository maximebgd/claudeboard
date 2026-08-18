"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X, Check, WandSparkles, Plus } from "lucide-react";
import Markdown from "./Markdown";
import ConfirmDialog from "./ConfirmDialog";
import { useTranslation } from "@/components/I18nProvider";

interface Props {
  /** Endpoint POST qui reçoit `{ ...payload, raw }`. */
  endpoint: string;
  /** Champs additionnels envoyés avec le contenu (scope, kind, slug, target…). */
  payload: Record<string, string>;
  initialRaw: string;
  mode: "json" | "markdown";
  /** Chemin affiché dans la boîte de confirmation. */
  label: string;
  /** false → le fichier n'existe pas encore : bouton « Créer ». */
  exists?: boolean;
  /** Placeholder pour un fichier absent (contenu de départ proposé). */
  emptyTemplate?: string;
  /** false → bouton « Éditer »/« Créer » grisé et inopérant (permission désactivée). */
  canWrite?: boolean;
  /** Éléments à afficher à droite dans la barre d'actions. */
  rightActions?: React.ReactNode;
}

/** Retire un frontmatter YAML en tête pour l'aperçu markdown live. */
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  const after = raw.indexOf("\n", end + 1);
  return after === -1 ? "" : raw.slice(after + 1);
}

export default function ConfigEditor({
  endpoint,
  payload,
  initialRaw,
  mode,
  label,
  exists = true,
  emptyTemplate = "",
  canWrite = true,
  rightActions,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  // Un fichier absent démarre en édition — sauf si l'écriture est verrouillée.
  const [editing, setEditing] = useState(!exists && canWrite);
  const [draft, setDraft] = useState(exists ? initialRaw : emptyTemplate);
  const [savedRaw, setSavedRaw] = useState(initialRaw);
  const [fileExists, setFileExists] = useState(exists);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  // Le contenu du fichier peut changer côté serveur pendant que ce composant reste
  // monté — typiquement après une restauration depuis le panneau Versions, qui
  // appelle `router.refresh()` et renvoie un nouvel `initialRaw`. On resynchronise
  // alors le contenu affiché pour voir la modification sans recharger la page. On ne
  // touche à rien si l'utilisateur est en train d'éditer (on ne veut pas écraser son
  // brouillon en cours).
  useEffect(() => {
    if (editing) return;
    setSavedRaw(initialRaw);
    setDraft(exists ? initialRaw : emptyTemplate);
    setFileExists(exists);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRaw, exists]);

  const dirty = draft !== savedRaw || !fileExists;

  const jsonError = useMemo(() => {
    if (mode !== "json" || !draft.trim()) return null;
    try {
      JSON.parse(draft);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : t("editor.jsonInvalid");
    }
  }, [draft, mode]);

  function formatJson() {
    try {
      setDraft(JSON.stringify(JSON.parse(draft), null, 2) + "\n");
    } catch {
      /* JSON invalide : on ne touche à rien */
    }
  }

  async function doSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, raw: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.writeFailed"));
      setSavedRaw(draft);
      setFileExists(true);
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

  const canSave = dirty && !jsonError;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
        {!editing ? (
          <button
            onClick={() => {
              if (!canWrite) return;
              setDraft(savedRaw);
              setEditing(true);
            }}
            aria-disabled={!canWrite || undefined}
            title={!canWrite ? t("lockedHint") : undefined}
            className={
              fileExists
                ? `flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm ${
                    canWrite ? "hover:bg-[var(--color-hover)]" : "cursor-not-allowed opacity-40"
                  }`
                : `flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-black ${
                    canWrite ? "hover:opacity-90" : "cursor-not-allowed opacity-40"
                  }`
            }
          >
            {fileExists ? <Pencil size={14} /> : <Plus size={14} />}
            {fileExists ? t("editor.edit") : t("editor.createFile")}
          </button>
        ) : (
          <>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSave}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40"
            >
              {fileExists ? <Save size={14} /> : <Plus size={14} />}
              {fileExists ? t("editor.save") : t("editor.createFile")}
            </button>
            {mode === "json" && (
              <button
                onClick={formatJson}
                disabled={!!jsonError}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-hover)] disabled:opacity-40"
                title={t("editor.formatTitle")}
              >
                <WandSparkles size={14} /> {t("editor.format")}
              </button>
            )}
            {fileExists && (
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
            )}
            {jsonError ? (
              <span className="text-xs text-red-400">{t("editor.jsonInvalid")}</span>
            ) : (
              dirty && <span className="text-xs text-amber-400">{t("editor.unsaved")}</span>
            )}
          </>
        )}
        {flash && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Check size={14} /> {fileExists ? t("editor.savedBackup") : t("editor.saved")}
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
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="w-full min-h-[60vh] rounded-xl border border-[var(--color-border)] bg-[var(--color-inset)] p-4 font-mono text-[13px] leading-relaxed text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]/50"
          />
          {jsonError && (
            <p className="mt-2 font-mono text-xs text-red-400">⚠ {jsonError}</p>
          )}
        </>
      ) : mode === "markdown" ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
          <Markdown>{stripFrontmatter(savedRaw)}</Markdown>
        </div>
      ) : (
        <pre className="w-full overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-inset)] p-4 font-mono text-[13px] leading-relaxed text-[var(--color-fg)]">
          {savedRaw || t("editor.emptyContent")}
        </pre>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={fileExists ? t("editor.confirmWrite", { label }) : t("editor.confirmCreate", { label })}
        description={fileExists ? t("editor.overwriteDesc") : t("editor.createDesc")}
        confirmLabel={fileExists ? t("editor.writeFile") : t("editor.createFile")}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doSave}
        detail={
          <div className="rounded-lg bg-[var(--color-inset)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
            <span className="text-[var(--color-fg)]">{label}</span>
          </div>
        }
      />
    </div>
  );
}
