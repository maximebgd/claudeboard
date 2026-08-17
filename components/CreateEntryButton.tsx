"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";

interface Props {
  /** Endpoint POST recevant `{ op: "create", ...extraBody, slug }`. */
  endpoint: string;
  /** Champs additionnels (ex. `{ kind: "agents" }`). */
  extraBody?: Record<string, unknown>;
  /** Base d'URL du détail — on navigue vers `${redirectBase}/${slug}` après succès. */
  redirectBase: string;
  label: string;
  placeholder?: string;
  /** Aide affichée sous le champ (ex. règles de nommage). */
  hint?: string;
  /** true → bouton grisé et inopérant (permission `create` désactivée). */
  locked?: boolean;
}

/**
 * Bouton « Créer » qui déplie un champ de nom, POST `op: "create"` puis navigue
 * vers la nouvelle entrée. Le contenu de départ (template) est posé côté serveur.
 */
export default function CreateEntryButton({
  endpoint,
  extraBody = {},
  redirectBase,
  label,
  placeholder,
  hint,
  locked = false,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const value = slug.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "create", ...extraBody, slug: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.createFailed"));
      router.push(`${redirectBase}/${data.slug ?? value}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          if (locked) return;
          setError(null);
          setOpen(true);
        }}
        aria-disabled={locked || undefined}
        title={locked ? t("lockedHint") : undefined}
        className={`flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-black ${
          locked ? "cursor-not-allowed opacity-40" : "hover:opacity-90"
        }`}
      >
        <Plus size={15} /> {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder ?? t("common.slugPlaceholder")}
          spellCheck={false}
          className="w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 font-mono text-[13px] outline-none focus:border-[var(--color-accent)]"
        />
        <button
          onClick={create}
          disabled={busy || !slug.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40"
        >
          <Plus size={15} /> {busy ? t("common.creating") : t("common.create")}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <X size={15} />
        </button>
      </div>
      {hint && <p className="mt-2 text-[11px] text-[var(--color-faint)]">{hint}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
