"use client";

import { Eye } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";

/** Pastille « Lecture seule » pour les pages qui n'éditent rien. */
export default function ReadOnlyBadge() {
  const { t } = useTranslation();
  return (
    <span
      title={t("readonly.title")}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-code)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)]"
    >
      <Eye size={12} /> {t("readonly.badge")}
    </span>
  );
}
