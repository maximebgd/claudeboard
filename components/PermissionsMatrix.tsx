"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, Check, AlertCircle, Lock, Eraser } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";

/** Valeurs d'une ressource : action → autorisée. Seules les actions applicables sont présentes. */
export type PermRow = Record<string, boolean>;
export type PermValues = Record<string, PermRow>;

export interface ResourceMeta {
  key: string;
  label: string;
  description: string;
  /** Actions applicables à cette ressource (sous-ensemble des colonnes). */
  actions: string[];
}

export interface ActionMeta {
  key: string;
  label: string;
  /** Ton destructif → mise en avant visuelle du basculement actif. */
  destructive?: boolean;
}

interface Props {
  resources: ResourceMeta[];
  /** Colonnes affichées (union ordonnée des actions). */
  columns: ActionMeta[];
  initial: PermValues;
}

/**
 * Matrice d'autorisations d'écriture de claudeboard. Chaque cellule est un
 * interrupteur ressource × action ; les paires non applicables sont grisées.
 * Persiste dans le store via /api/store (section `permissions`). Tout est `false`
 * par défaut — activer une case débloque l'action correspondante dans l'app.
 */
export default function PermissionsMatrix({ resources, columns, initial }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [values, setValues] = useState<PermValues>(initial);
  const [saved, setSaved] = useState<PermValues>(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  const enabledCount = useMemo(
    () => resources.reduce((n, r) => n + r.actions.filter((a) => values[r.key]?.[a]).length, 0),
    [resources, values]
  );

  function applies(resourceKey: string, actionKey: string): boolean {
    const res = resources.find((r) => r.key === resourceKey);
    return Boolean(res?.actions.includes(actionKey));
  }

  /** Ressources concernées par une action (celles qui l'exposent). */
  function resourcesFor(actionKey: string): ResourceMeta[] {
    return resources.filter((r) => r.actions.includes(actionKey));
  }

  /** true si toutes les cases applicables d'une colonne sont actives. */
  function columnAllOn(actionKey: string): boolean {
    const rows = resourcesFor(actionKey);
    return rows.length > 0 && rows.every((r) => values[r.key]?.[actionKey]);
  }

  function toggle(resourceKey: string, actionKey: string) {
    if (!applies(resourceKey, actionKey)) return;
    setStatus(null);
    setValues((prev) => ({
      ...prev,
      [resourceKey]: { ...prev[resourceKey], [actionKey]: !prev[resourceKey]?.[actionKey] },
    }));
  }

  /** Bascule toute une colonne : si tout est déjà actif → off, sinon → on. */
  function toggleColumn(actionKey: string) {
    setStatus(null);
    const target = !columnAllOn(actionKey);
    setValues((prev) => {
      const next = { ...prev };
      for (const r of resourcesFor(actionKey)) {
        next[r.key] = { ...next[r.key], [actionKey]: target };
      }
      return next;
    });
  }

  /** Remet toutes les autorisations à zéro (à sauvegarder ensuite). */
  function resetAll() {
    setStatus(null);
    const next: PermValues = {};
    for (const r of resources) {
      next[r.key] = {};
      for (const a of r.actions) next[r.key][a] = false;
    }
    setValues(next);
  }

  function revert() {
    setStatus(null);
    setValues(saved);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "permissions", op: "save", permissions: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setSaved(values);
      setStatus({ kind: "ok", msg: t("perm.saved") });
      router.refresh();
    } catch (e) {
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : t("common.writeFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-code)] text-left text-xs text-[var(--color-muted)]">
              <th className="px-4 py-2.5 font-medium">{t("perm.resource")}</th>
              {columns.map((c) => {
                const allOn = columnAllOn(c.key);
                return (
                  <th key={c.key} className="px-4 py-2.5 font-medium text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span>{c.label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={allOn}
                        aria-label={`${allOn ? t("perm.disableAll") : t("perm.enableAll")} — ${c.label}`}
                        title={allOn ? t("perm.disableAll") : t("perm.enableAll")}
                        onClick={() => toggleColumn(c.key)}
                        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                          allOn
                            ? c.destructive
                              ? "bg-red-500"
                              : "bg-[var(--color-accent)]"
                            : "bg-[var(--color-border)]"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            allOn ? "translate-x-3.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.key} className="border-t border-[var(--color-border)] align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-[11px] text-[var(--color-muted)]">{r.description}</div>
                </td>
                {columns.map((c) => {
                  const ok = applies(r.key, c.key);
                  const on = ok && Boolean(values[r.key]?.[c.key]);
                  return (
                    <td key={c.key} className="px-4 py-3 text-center">
                      {ok ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${r.label} — ${c.label}`}
                          onClick={() => toggle(r.key, c.key)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            on
                              ? c.destructive
                                ? "bg-red-500"
                                : "bg-[var(--color-accent)]"
                              : "bg-[var(--color-border)]"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              on ? "translate-x-4" : "translate-x-1"
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="text-[var(--color-faint)]">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={15} />
          {busy ? t("perm.saving") : t("perm.save")}
        </button>
        <button
          onClick={revert}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-fg)] disabled:opacity-40"
        >
          <RotateCcw size={15} />
          {t("common.cancel")}
        </button>
        <button
          onClick={resetAll}
          disabled={busy || enabledCount === 0}
          title={t("perm.resetTitle")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
        >
          <Eraser size={15} />
          {t("reset.label")}
        </button>
        {/* <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <Lock size={13} />
          {enabledCount === 0
            ? "Tout verrouillé"
            : `${enabledCount} action${enabledCount > 1 ? "s" : ""} autorisée${enabledCount > 1 ? "s" : ""}`}
        </span> */}
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 text-sm ${
              status.kind === "ok" ? "text-[var(--color-accent)]" : "text-red-500"
            }`}
          >
            {status.kind === "ok" ? <Check size={15} /> : <AlertCircle size={15} />}
            {status.msg}
          </span>
        )}
      </div>
    </div>
  );
}
