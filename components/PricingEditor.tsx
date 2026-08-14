"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, Eraser, Check, AlertCircle } from "lucide-react";

export interface PricingRow {
  in: number;
  out: number;
  cacheWrite: number;
  cacheRead: number;
}

interface FamilyMeta {
  key: string;
  label: string;
  color: string;
}

interface ColMeta {
  key: keyof PricingRow;
  label: string;
  hint: string;
}

interface Props {
  families: FamilyMeta[];
  cols: ColMeta[];
  /** Tarifs par défaut (codés dans `lib/analytics.ts`). */
  defaults: Record<string, PricingRow>;
  /** Tarifs effectifs actuels (défauts + overrides du store). */
  initial: Record<string, PricingRow>;
}

type FormValues = Record<string, Record<string, string>>;

/** Transforme une table de tarifs en valeurs de formulaire (chaînes éditables). */
function toForm(table: Record<string, PricingRow>, cols: ColMeta[], families: FamilyMeta[]): FormValues {
  const out: FormValues = {};
  for (const fam of families) {
    const row = table[fam.key] ?? { in: 0, out: 0, cacheWrite: 0, cacheRead: 0 };
    out[fam.key] = {};
    for (const c of cols) out[fam.key][c.key] = String(row[c.key]);
  }
  return out;
}

/** Parse une valeur de formulaire ; renvoie null si ce n'est pas un nombre ≥ 0 fini. */
function parseCell(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Éditeur des tarifs d'estimation. Écrit dans le store claudeboard via /api/store
 * (section `pricing`). Seules les familles dont un tarif diffère des défauts sont
 * envoyées comme overrides — les autres retombent sur les valeurs de `lib/analytics.ts`.
 */
export default function PricingEditor({ families, cols, defaults, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toForm(initial, cols, families));
  const [saved, setSaved] = useState<FormValues>(() => toForm(initial, cols, families));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);

  const defaultForm = useMemo(() => toForm(defaults, cols, families), [defaults, cols, families]);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(saved),
    [values, saved]
  );

  /** true si la famille diffère des tarifs par défaut (badge « modifié »). */
  function isOverridden(famKey: string): boolean {
    return cols.some((c) => values[famKey]?.[c.key] !== defaultForm[famKey]?.[c.key]);
  }

  function invalidCell(famKey: string, colKey: string): boolean {
    return parseCell(values[famKey]?.[colKey] ?? "") === null;
  }

  function setCell(famKey: string, colKey: string, v: string) {
    setStatus(null);
    setValues((prev) => ({ ...prev, [famKey]: { ...prev[famKey], [colKey]: v } }));
  }

  function fillDefaults() {
    setStatus(null);
    setValues(defaultForm);
  }

  function revert() {
    setStatus(null);
    setValues(saved);
  }

  async function save() {
    if (busy) return;
    // Construit les overrides : uniquement les familles qui diffèrent des défauts.
    const overrides: Record<string, PricingRow> = {};
    for (const fam of families) {
      const row: Partial<PricingRow> = {};
      let ok = true;
      for (const c of cols) {
        const n = parseCell(values[fam.key][c.key]);
        if (n === null) {
          ok = false;
          break;
        }
        row[c.key] = n;
      }
      if (!ok) {
        setStatus({ kind: "error", msg: "Certaines valeurs sont invalides (nombres ≥ 0 attendus)." });
        return;
      }
      if (isOverridden(fam.key)) overrides[fam.key] = row as PricingRow;
    }

    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "pricing", op: "save", overrides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      setSaved(values);
      setStatus({ kind: "ok", msg: "Tarifs enregistrés." });
      router.refresh(); // recalcule les stats du dashboard avec les nouveaux tarifs
    } catch (e) {
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : "Échec de l'écriture" });
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
              <th className="px-4 py-2 font-medium">Famille</th>
              {cols.map((c) => (
                <th key={c.key} className="px-4 py-2 font-medium text-right">
                  {c.label}
                  <span className="block font-normal text-[10px] text-[var(--color-faint)]">
                    {c.hint}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {families.map((fam) => (
              <tr key={fam.key} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: fam.color }}
                    />
                    {fam.label}
                    {isOverridden(fam.key) && (
                      <span className="rounded bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                        modifié
                      </span>
                    )}
                  </span>
                </td>
                {cols.map((c) => {
                  const bad = invalidCell(fam.key, c.key);
                  return (
                    <td key={c.key} className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[var(--color-faint)]">$</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={values[fam.key][c.key]}
                          onChange={(e) => setCell(fam.key, c.key, e.target.value)}
                          className={`w-20 rounded-md border bg-[var(--color-bg)] px-2 py-1 text-right font-mono text-[12px] tabular-nums outline-none focus:border-[var(--color-accent)] ${
                            bad ? "border-red-500" : "border-[var(--color-border)]"
                          }`}
                          aria-label={`${fam.label} — ${c.label}`}
                        />
                      </div>
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
          {busy ? "Enregistrement…" : "Sauvegarder"}
        </button>
        <button
          onClick={revert}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-fg)] disabled:opacity-40"
        >
          <RotateCcw size={15} />
          Annuler
        </button>
        <button
          onClick={fillDefaults}
          disabled={busy}
          title="Remettre tous les tarifs à leurs valeurs par défaut"
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
        >
          <Eraser size={15} />
          Réinitialiser
        </button>
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
