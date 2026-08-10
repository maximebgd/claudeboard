import { ArrowDown, ArrowUp, DollarSign } from "lucide-react";
import { PRICING, MODEL_LABEL, MODEL_COLOR, type ModelFamily } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// Familles affichées (on masque « autre », dont tous les tarifs valent 0).
const FAMILIES: ModelFamily[] = ["opus", "sonnet", "haiku", "fable"];

const COLS: { key: keyof (typeof PRICING)["opus"]; label: string; hint: string }[] = [
  { key: "in", label: "Input", hint: "tokens d'entrée frais" },
  { key: "out", label: "Output", hint: "tokens de sortie" },
  { key: "cacheWrite", label: "Écriture cache", hint: "cache_creation (TTL 1 h)" },
  { key: "cacheRead", label: "Lecture cache", hint: "cache_read" },
];

const usd = (n: number) => `$${n.toFixed(2)}`;

export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <DollarSign size={22} className="text-[var(--color-accent)]" />
        Tarifs d'estimation
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Tarifs appliqués pour estimer le coût affiché dans le dashboard. Valeurs en
        USD par million de tokens.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-code)] text-left text-xs text-[var(--color-muted)]">
              <th className="px-4 py-2 font-medium">Famille</th>
              {COLS.map((c) => (
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
            {FAMILIES.map((fam) => (
              <tr key={fam} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: MODEL_COLOR[fam] }}
                    />
                    {MODEL_LABEL[fam]}
                  </span>
                </td>
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className="px-4 py-2 text-right font-mono text-[12px] tabular-nums"
                  >
                    {usd(PRICING[fam][c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 space-y-4 text-sm text-[var(--color-muted)]">
        <div>
          <div className="eyebrow pb-1">Convention IN / OUT</div>
          <p>
            Partout dans le dashboard, l'affichage suit ce sens&nbsp;:
          </p>
          <ul className="mt-2 space-y-1">
            <li className="inline-flex items-center gap-2">
              <ArrowUp size={14} className="text-[var(--color-accent)]" />
              <span>
                <strong>IN</strong> = ce que tu envoies (ton prompt&nbsp;: instructions,
                historique, fichiers…) — <em>flèche vers le haut</em>.
              </span>
            </li>
            <li className="inline-flex items-center gap-2">
              <ArrowDown size={14} className="text-[var(--color-accent)]" />
              <span>
                <strong>OUT</strong> = ce que tu reçois (la réponse générée par le
                modèle) — <em>flèche vers le bas</em>.
              </span>
            </li>
          </ul>
        </div>

        <div>
          <div className="eyebrow pb-1">Comment le coût est calculé</div>
          <p>
            Pour chaque réponse de l'assistant, on lit son bloc{" "}
            <code className="rounded bg-[var(--color-code)] px-1 py-0.5 font-mono text-[12px]">
              usage
            </code>{" "}
            et on applique&nbsp;:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-code)] px-4 py-3 font-mono text-[12px] text-[var(--color-fg)]">
{`coût = (input × prix_in
      + output × prix_out
      + cache_read × prix_cacheRead
      + cache_write × prix_cacheWrite) / 1 000 000`}
          </pre>
          <p className="mt-2">
            Le tarif dépend de la famille du modèle (déduite de l'id, ex.{" "}
            <code className="rounded bg-[var(--color-code)] px-1 py-0.5 font-mono text-[12px]">
              claude-opus-4-8
            </code>{" "}
            → Opus). Les modèles inconnus ou synthétiques sont facturés à 0.
          </p>
        </div>

        <div>
          <div className="eyebrow pb-1">Écriture cache : TTL 1 h</div>
          <p>
            Le prix d'écriture cache utilise le tarif TTL 1 h (celui employé par
            Claude Code). Les tokens{" "}
            <code className="rounded bg-[var(--color-code)] px-1 py-0.5 font-mono text-[12px]">
              cache_creation_input_tokens
            </code>{" "}
            sont tous facturés à ce tarif.
          </p>
        </div>

        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-[13px]">
          ⚠️ Ce sont des <strong>tarifs indicatifs</strong> servant à une estimation
          locale — ce n'est pas une facturation réelle. Ils sont codés en dur dans{" "}
          <code className="font-mono text-[12px]">lib/analytics.ts</code>.
        </p>
      </div>
    </div>
  );
}
