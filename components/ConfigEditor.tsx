"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X, Check, WandSparkles, Plus } from "lucide-react";
import Markdown from "./Markdown";
import ConfirmDialog from "./ConfirmDialog";
import PermissionNotice from "./PermissionNotice";

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
  /** false → écriture verrouillée (permission désactivée). */
  canWrite?: boolean;
  /** Message du bandeau lecture seule (si `canWrite` est false). */
  lockedLabel?: string;
  /**
   * Bandeau « verrouillé » piloté par l'appelant : si défini (même à `null`), il
   * prend le pas sur la logique `canWrite`/`lockedLabel` (une chaîne s'affiche,
   * `null` masque le bandeau). Sert aux libellés dynamiques listant les actions
   * encore interdites indépendamment du droit de modification courant.
   */
  lockedNotice?: string | null;
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
  lockedLabel,
  lockedNotice,
  rightActions,
}: Props) {
  const router = useRouter();
  // Un fichier absent démarre en édition — sauf si l'écriture est verrouillée.
  const [editing, setEditing] = useState(!exists && canWrite);
  const [draft, setDraft] = useState(exists ? initialRaw : emptyTemplate);
  const [savedRaw, setSavedRaw] = useState(initialRaw);
  const [fileExists, setFileExists] = useState(exists);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const dirty = draft !== savedRaw || !fileExists;

  const jsonError = useMemo(() => {
    if (mode !== "json" || !draft.trim()) return null;
    try {
      JSON.parse(draft);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "JSON invalide";
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
      if (!res.ok) throw new Error(data.error || "Échec de l'écriture");
      setSavedRaw(draft);
      setFileExists(true);
      setConfirmOpen(false);
      setEditing(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 2500);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  const canSave = dirty && !jsonError;

  return (
    <div>
      {(lockedNotice !== undefined
        ? lockedNotice
        : !canWrite
          ? lockedLabel ?? (exists ? "Modification verrouillée." : "Création verrouillée.")
          : null) && (
        <PermissionNotice>
          {lockedNotice !== undefined
            ? lockedNotice
            : lockedLabel ?? (exists ? "Modification verrouillée." : "Création verrouillée.")}
        </PermissionNotice>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
        {!canWrite ? null : !editing ? (
          <button
            onClick={() => {
              setDraft(savedRaw);
              setEditing(true);
            }}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-hover)]"
          >
            <Pencil size={14} /> Éditer
          </button>
        ) : (
          <>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSave}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40"
            >
              {fileExists ? <Save size={14} /> : <Plus size={14} />}
              {fileExists ? "Enregistrer" : "Créer le fichier"}
            </button>
            {mode === "json" && (
              <button
                onClick={formatJson}
                disabled={!!jsonError}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-hover)] disabled:opacity-40"
                title="Reformater le JSON (2 espaces)"
              >
                <WandSparkles size={14} /> Formater
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
                <X size={14} /> Annuler
              </button>
            )}
            {jsonError ? (
              <span className="text-xs text-red-400">JSON invalide</span>
            ) : (
              dirty && <span className="text-xs text-amber-400">Modifications non enregistrées</span>
            )}
          </>
        )}
        {flash && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Check size={14} /> Enregistré {fileExists ? "(backup créé)" : ""}
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
          {savedRaw || "(vide)"}
        </pre>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={fileExists ? `Écrire ${label} ?` : `Créer ${label} ?`}
        description={
          fileExists
            ? "Le fichier va être écrasé. Une copie de sauvegarde horodatée (.bak) sera créée automatiquement."
            : "Le fichier n'existe pas encore et va être créé."
        }
        confirmLabel={fileExists ? "Écrire le fichier" : "Créer le fichier"}
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
