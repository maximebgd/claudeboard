"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle, Sparkles, ImageOff } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";
import { LOGO_FILES, logoSrc, type LogoFile } from "@/lib/logos";
import type { LogoPreference } from "@/lib/store";

/**
 * Réglage du logo de la Sidebar (à gauche de « Claude Board »).
 * - **Désactivé** → invite terminal `›_` (aucun logo).
 * - **Activé** → le logo « clawd » choisi, **un seul** (sélection unique).
 * Persisté dans le store claudeboard (section `preferences`, champ `logo`).
 */
export default function LogoSelector({ initial }: { initial: LogoPreference }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"off" | "on">(initial.mode);
  const [selected, setSelected] = useState<LogoFile>(initial.selected);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);

  // Persiste un nouvel état (optimiste) ; en cas d'échec, restaure le précédent.
  async function persist(next: { mode: "off" | "on"; selected: LogoFile }) {
    const prev = { mode, selected };
    setMode(next.mode);
    setSelected(next.selected);
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "preferences",
          op: "save",
          logo: { mode: next.mode, selected: next.selected },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setStatus({ kind: "ok", msg: t("prefs.saved") });
      router.refresh();
    } catch (e) {
      setMode(prev.mode);
      setSelected(prev.selected);
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : t("common.writeFailed") });
    } finally {
      setBusy(false);
    }
  }

  function setModeAndPersist(value: "off" | "on") {
    if (busy || value === mode) return;
    persist({ mode: value, selected });
  }

  function selectLogo(file: LogoFile) {
    if (busy) return;
    if (mode === "on" && file === selected) return;
    persist({ mode: "on", selected: file });
  }

  const modeOptions: { value: "off" | "on"; icon: typeof Sparkles; label: string; hint: string }[] = [
    { value: "on", icon: Sparkles, label: t("logo.on"), hint: t("logo.on.hint") },
    { value: "off", icon: ImageOff, label: t("logo.off"), hint: t("logo.off.hint") },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {modeOptions.map(({ value, icon: Icon, label, hint }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setModeAndPersist(value)}
              disabled={busy}
              aria-pressed={active}
              className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-60 ${
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-hover)]"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {active ? (
                  <Check size={14} className="text-[var(--color-accent)]" />
                ) : (
                  <Icon size={14} className="text-[var(--color-faint)]" />
                )}
                {label}
              </span>
              <span className="font-mono text-[11px] text-[var(--color-faint)]">{hint}</span>
            </button>
          );
        })}
      </div>

      {mode === "on" && (
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {LOGO_FILES.map((file) => {
            const on = file === selected;
            return (
              <button
                key={file}
                type="button"
                onClick={() => selectLogo(file)}
                disabled={busy}
                aria-pressed={on}
                title={file}
                className={`relative flex aspect-square items-center justify-center rounded-lg border transition disabled:opacity-60 ${
                  on
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] opacity-50 hover:opacity-100 hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-hover)]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc(file)} alt={file} className="h-16 w-16" />
                {on && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
                    <Check size={11} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-sm">
        {status ? (
          <span
            className={`inline-flex items-center gap-1.5 ${
              status.kind === "ok" ? "text-[var(--color-accent)]" : "text-red-500"
            }`}
          >
            {status.kind === "ok" ? <Check size={15} /> : <AlertCircle size={15} />}
            {status.msg}
          </span>
        ) : (
          <span className="text-[var(--color-faint)]">{t("logo.footer")}</span>
        )}
      </div>
    </div>
  );
}
