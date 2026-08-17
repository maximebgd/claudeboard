"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";

/**
 * Bandeau « lecture seule » affiché quand une action d'écriture est verrouillée
 * dans les Préférences. Renvoie vers la page où l'activer. Purement informatif :
 * l'API refuse de toute façon l'écriture côté serveur.
 */
export default function PermissionNotice({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm text-[var(--color-muted)]">
      <Lock size={14} className="text-[var(--color-muted)]" />
      <span>{children ?? t("permNotice.default")}</span>
      <Link
        href="/config/preferences"
        className="font-medium text-[var(--color-accent)] hover:underline"
      >
        {t("permNotice.enable")}
      </Link>
    </div>
  );
}
