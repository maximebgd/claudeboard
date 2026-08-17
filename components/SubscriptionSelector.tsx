"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Check, AlertCircle, Sparkles } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";

interface PlanOption {
  /** Valeur envoyée au store (`pro` | `max5x` | `max20x` | `none`). */
  value: string;
  label: string;
  /** Prix pré-formaté (ex. « 20 $/mois ») ou « — ». */
  price: string;
}

interface Props {
  /** Sélection courante : « auto » ou une valeur de plan manuel. */
  initialSelection: string;
  /** Plan auto-détecté depuis ~/.claude.json (affiché sous l'option « Automatique »). */
  detected: { label: string; known: boolean };
  planOptions: PlanOption[];
}

/**
 * Sélecteur du type d'abonnement pour adapter l'estimation de rentabilité. Deux
 * modes : « Automatique » (détecté depuis ~/.claude.json) ou un plan choisi à la
 * main. Le choix est persisté dans le store claudeboard (section `subscription`) ;
 * `router.refresh()` recalcule l'économie nette du dashboard avec le plan retenu.
 */
export default function SubscriptionSelector({ initialSelection, detected, planOptions }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [selection, setSelection] = useState(initialSelection);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);

  async function choose(value: string) {
    if (busy || value === selection) return;
    const prev = selection;
    setSelection(value); // optimiste
    setBusy(true);
    setStatus(null);
    const payload =
      value === "auto"
        ? { section: "subscription", op: "save", source: "auto", plan: null }
        : { section: "subscription", op: "save", source: "manual", plan: value };
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setStatus({ kind: "ok", msg: t("sub.saved") });
      router.refresh();
    } catch (e) {
      setSelection(prev); // revert
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : t("common.writeFailed") });
    } finally {
      setBusy(false);
    }
  }

  const tile = (value: string, active: boolean, title: React.ReactNode, sub: React.ReactNode) => (
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
        {active && <Check size={14} className="text-[var(--color-accent)]" />}
        {title}
      </span>
      <span className="font-mono text-[11px] text-[var(--color-faint)]">{sub}</span>
    </button>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tile(
          "auto",
          selection === "auto",
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={14} className="text-[var(--color-accent)]" />
            {t("sub.auto")}
          </span>,
          detected.known ? t("sub.detected", { label: detected.label }) : t("sub.noneDetected")
        )}
        {planOptions.map((p) =>
          tile(
            p.value,
            selection === p.value,
            <span className="inline-flex items-center gap-1.5">
              <Wallet size={14} className="text-[var(--color-faint)]" />
              {p.label}
            </span>,
            p.price
          )
        )}
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
          <span className="text-[var(--color-faint)]">
            {selection === "auto" ? t("sub.autoHint") : t("sub.manualHint")}
          </span>
        )}
      </div>
    </div>
  );
}
