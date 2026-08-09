import { Eye } from "lucide-react";

/** Pastille « Lecture seule » pour les pages qui n'éditent rien. */
export default function ReadOnlyBadge() {
  return (
    <span
      title="Cette page est en lecture seule"
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-code)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)]"
    >
      <Eye size={12} /> Lecture seule
    </span>
  );
}
