"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Wallet, Check, AlertCircle } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";

type Mode = "usage" | "savings";

/**
 * Choix de la valeur affichée **en premier** par la carte KPI « Coût estimé » du
 * dashboard : le coût d'usage estimé, ou l'économie réalisée grâce à l'abonnement.
 * La carte reste cliquable pour basculer ponctuellement ; ce réglage ne fixe que
 * l'affichage par défaut. Persisté dans le store claudeboard (section `preferences`).
 */
export default function CostModeSelector({ initial }: { initial: Mode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);

  async function choose(value: Mode) {
    if (busy || value === mode) return;
    const prev = mode;
    setMode(value); // optimiste
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "preferences", op: "save", costCardMode: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setStatus({ kind: "ok", msg: t("prefs.saved") });
      router.refresh();
    } catch (e) {
      setMode(prev); // revert
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : t("common.writeFailed") });
    } finally {
      setBusy(false);
    }
  }

  const options: { value: Mode; icon: typeof Coins; label: string; hint: string }[] = [
    { value: "usage", icon: Coins, label: t("costMode.usage"), hint: t("costMode.usage.hint") },
    { value: "savings", icon: Wallet, label: t("costMode.savings"), hint: t("costMode.savings.hint") },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map(({ value, icon: Icon, label, hint }) => {
          const active = mode === value;
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
          <span className="text-[var(--color-faint)]">{t("costMode.footer")}</span>
        )}
      </div>
    </div>
  );
}
