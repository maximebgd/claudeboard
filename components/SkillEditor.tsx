"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X, Check } from "lucide-react";
import Markdown from "./Markdown";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  slug: string;
  initialRaw: string;
  content: string; // corps markdown (pour l'aperçu en lecture)
}

export default function SkillEditor({ slug, initialRaw, content }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialRaw);
  const [savedRaw, setSavedRaw] = useState(initialRaw);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const dirty = draft !== savedRaw;

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
      if (!res.ok) throw new Error(data.error || "Échec de l'écriture");
      setSavedRaw(draft);
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

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {!editing ? (
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
              disabled={!dirty}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40"
            >
              <Save size={14} /> Enregistrer
            </button>
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
            {dirty && <span className="text-xs text-amber-400">Modifications non enregistrées</span>}
          </>
        )}
        {flash && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Check size={14} /> Enregistré (backup créé)
          </span>
        )}
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
        title="Écrire dans SKILL.md ?"
        description={`Le fichier du skill « ${slug} » va être écrasé. Une copie de sauvegarde horodatée (.bak) sera créée automatiquement.`}
        confirmLabel="Écrire le fichier"
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
