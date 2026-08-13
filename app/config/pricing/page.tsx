import { ArrowDown, ArrowUp, DollarSign } from "lucide-react";
import {
  PRICING,
  getEffectivePricing,
  MODEL_LABEL,
  MODEL_COLOR,
  type ModelFamily,
} from "@/lib/analytics";
import PricingEditor from "@/components/PricingEditor";

export const dynamic = "force-dynamic";

// Familles affichées/éditables (on masque « autre », dont tous les tarifs valent 0).
const FAMILIES: ModelFamily[] = ["opus", "sonnet", "haiku", "fable"];

const COLS = [
  { key: "in", label: "Input", hint: "tokens d'entrée frais" },
  { key: "out", label: "Output", hint: "tokens de sortie" },
  { key: "cacheWrite", label: "Écriture cache", hint: "cache_creation (TTL 1 h)" },
  { key: "cacheRead", label: "Lecture cache", hint: "cache_read" },
] as const;

export default async function PricingPage() {
  const effective = await getEffectivePricing();
  const families = FAMILIES.map((fam) => ({
    key: fam,
    label: MODEL_LABEL[fam],
    color: MODEL_COLOR[fam],
  }));
  const defaults = Object.fromEntries(FAMILIES.map((fam) => [fam, PRICING[fam]]));
  const initial = Object.fromEntries(FAMILIES.map((fam) => [fam, effective[fam]]));

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <DollarSign size={22} className="text-[var(--color-accent)]" />
        Tarifs d'estimation
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Tarifs appliqués pour estimer le coût affiché dans le dashboard. Valeurs en
        USD par million de tokens — modifiables ci-dessous, puis « Sauvegarder ».
      </p>

      <div className="mt-6">
        <PricingEditor
          families={families}
          cols={COLS.map((c) => ({ ...c }))}
          defaults={defaults}
          initial={initial}
        />
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
          locale — ce n'est pas une facturation réelle. Les valeurs par défaut viennent
          de <code className="font-mono text-[12px]">lib/analytics.ts</code> ; les
          modifications enregistrées ici sont stockées dans{" "}
          <code className="font-mono text-[12px]">data/claudeboard.json</code> et
          appliquées à toutes les estimations. « Réinitialiser » restaure les défauts.
        </p>
      </div>
    </div>
  );
}
