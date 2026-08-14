"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  /** Endpoint POST recevant `body` (avec `op: "reset"`). */
  endpoint: string;
  body: Record<string, unknown>;
  title: string;
  description?: string;
  detail?: React.ReactNode;
  label?: string;
}

/**
 * Bouton de réinitialisation d'un fichier de config à son contenu par défaut
 * (backup préalable côté serveur), avec confirmation. Rafraîchit en place.
 */
export default function ResetButton({
  endpoint,
  body,
  title,
  description,
  detail,
  label = "Réinitialiser",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doReset() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "reset", ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de la réinitialisation");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
      >
        <RotateCcw size={14} /> {label}
      </button>
      {error && (
        <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        detail={detail}
        confirmLabel={label}
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={doReset}
      />
    </>
  );
}
