"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { LOCKED_HINT } from "./lockedHint";

interface Props {
  /** Endpoint POST recevant `body` (avec `op: "delete"`). */
  endpoint: string;
  body: Record<string, unknown>;
  title: string;
  description?: string;
  detail?: React.ReactNode;
  confirmLabel?: string;
  /** Libellé du bouton (défaut « Supprimer »). */
  label?: string;
  /** Redirection après succès ; sinon on rafraîchit la page en place. */
  redirectTo?: string;
  /** true → bouton grisé et inopérant (permission `delete` désactivée). */
  locked?: boolean;
}

/**
 * Bouton de suppression réversible (déplacement en corbeille côté serveur) avec
 * confirmation. N'apparaît que là où la permission `delete` correspondante est
 * accordée — l'API revérifie de toute façon.
 */
export default function DeleteButton({
  endpoint,
  body,
  title,
  description,
  detail,
  confirmLabel = "Supprimer",
  label = "Supprimer",
  redirectTo,
  locked = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "delete", ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de la suppression");
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          if (locked) return;
          setError(null);
          setOpen(true);
        }}
        aria-disabled={locked || undefined}
        title={locked ? LOCKED_HINT : undefined}
        className={`flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 ${
          locked ? "cursor-not-allowed opacity-40" : "hover:bg-red-500/10"
        }`}
      >
        <Trash2 size={14} /> {label}
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
        confirmLabel={confirmLabel}
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={doDelete}
      />
    </>
  );
}
