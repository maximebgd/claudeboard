"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";
import type { Language } from "@/lib/i18n/core";

/**
 * Choix de la langue de l'interface (français / anglais). Persisté dans le store
 * claudeboard (section `preferences`). Après enregistrement, `router.refresh()`
 * re-rend l'arbre depuis `layout.tsx` : les server components relisent la langue et
 * le `I18nProvider` est re-seedé — toute l'UI bascule immédiatement.
 */
export default function LanguageSelector({ initial }: { initial: Language }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [lang, setLang] = useState<Language>(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);

  async function choose(value: Language) {
    if (busy || value === lang) return;
    const prev = lang;
    setLang(value); // optimiste
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "preferences", op: "save", language: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setStatus({ kind: "ok", msg: t("prefs.saved") });
      router.refresh();
    } catch (e) {
      setLang(prev); // revert
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : t("common.writeFailed") });
    } finally {
      setBusy(false);
    }
  }

  const options: { value: Language; label: string; hint: string; flag: string }[] = [
    { value: "fr", label: t("prefs.language.fr"), hint: t("prefs.language.fr.hint"), flag: "🇫🇷" },
    { value: "en", label: t("prefs.language.en"), hint: t("prefs.language.en.hint"), flag: "🇬🇧" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map(({ value, label, hint, flag }) => {
          const active = lang === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              disabled={busy}
              aria-pressed={active}
              className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-60 ${
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-hover)]"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span className="text-base leading-none" aria-hidden>{flag}</span>
                {label}
                {active ? <Check size={14} className="text-[var(--color-accent)]" /> : null}
              </span>
              <span className="font-mono text-[11px] text-[var(--color-faint)]">{hint}</span>
            </button>
          );
        })}
      </div>

      {status ? (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 ${
              status.kind === "ok" ? "text-[var(--color-accent)]" : "text-red-500"
            }`}
          >
            {status.kind === "ok" ? <Check size={15} /> : <AlertCircle size={15} />}
            {status.msg}
          </span>
        </div>
      ) : null}
    </div>
  );
}
