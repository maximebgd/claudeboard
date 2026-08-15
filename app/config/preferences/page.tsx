import { ArrowDown, ArrowUp, DollarSign, Wallet, SlidersHorizontal, ShieldCheck } from "lucide-react";
import {
  PRICING,
  getEffectivePricing,
  MODEL_LABEL,
  MODEL_COLOR,
  type ModelFamily,
} from "@/lib/analytics";
import { getEffectiveSubscription, PLANS } from "@/lib/subscription";
import { getPermissions, PERMISSION_SCHEMA, type PermissionResource } from "@/lib/store";
import PricingEditor from "@/components/PricingEditor";
import SubscriptionSelector from "@/components/SubscriptionSelector";
import PermissionsMatrix, {
  type ResourceMeta,
  type ActionMeta,
  type PermValues,
} from "@/components/PermissionsMatrix";

export const dynamic = "force-dynamic";

// Familles affichées/éditables (on masque « autre », dont tous les tarifs valent 0).
const FAMILIES: ModelFamily[] = ["opus", "sonnet", "haiku", "fable"];

const COLS = [
  { key: "in", label: "Input", hint: "tokens d'entrée frais" },
  { key: "out", label: "Output", hint: "tokens de sortie" },
  { key: "cacheWrite", label: "Écriture cache", hint: "cache_creation (TTL 1 h)" },
  { key: "cacheRead", label: "Lecture cache", hint: "cache_read" },
] as const;

// Colonnes de la matrice (union ordonnée des actions ; delete/reset sont destructives).
const ACTION_COLUMNS: ActionMeta[] = [
  { key: "create", label: "Créer" },
  { key: "modify", label: "Modifier" },
  { key: "delete", label: "Supprimer", destructive: true },
  { key: "reset", label: "Réinitialiser", destructive: true },
];

// Libellé + description par ressource (l'ordre suit PERMISSION_SCHEMA).
const RESOURCE_META: Record<PermissionResource, { label: string; description: string }> = {
  skills: { label: "Skills", description: "Créer, modifier ou supprimer les SKILL.md" },
  projects: { label: "Projets & Sessions", description: "Supprimer un projet ou une session" },
  claudeMd: { label: "CLAUDE.md", description: "Créer, modifier, supprimer ou réinitialiser le CLAUDE.md global" },
  agents: { label: "Agents", description: "Créer, modifier ou supprimer des agents" },
  commands: { label: "Commandes", description: "Créer, modifier ou supprimer des commandes" },
  settings: { label: "Settings Claude", description: "Modifier ou réinitialiser settings.json" },
  hooks: { label: "Hooks", description: "Éditer le bloc hooks de settings.json (créer/supprimer/modifier)" },
  keybindings: { label: "Keybindings", description: "Créer, modifier, supprimer ou réinitialiser keybindings.json" },
};

export default async function PreferencesPage() {
  const [effective, sub, permissions] = await Promise.all([
    getEffectivePricing(),
    getEffectiveSubscription(),
    getPermissions(),
  ]);

  const families = FAMILIES.map((fam) => ({
    key: fam,
    label: MODEL_LABEL[fam],
    color: MODEL_COLOR[fam],
  }));
  const defaults = Object.fromEntries(FAMILIES.map((fam) => [fam, PRICING[fam]]));
  const initial = Object.fromEntries(FAMILIES.map((fam) => [fam, effective[fam]]));

  const planOptions = [
    ...Object.entries(PLANS).map(([value, p]) => ({
      value,
      label: p.label,
      price: `${p.monthlyPriceUSD} $/mois`,
    })),
    { value: "none", label: "Aucun", price: "—" },
  ];
  const subSelection = sub.source === "manual" ? sub.type : "auto";

  const resources: ResourceMeta[] = (Object.keys(PERMISSION_SCHEMA) as PermissionResource[]).map(
    (key) => ({
      key,
      label: RESOURCE_META[key].label,
      description: RESOURCE_META[key].description,
      actions: [...PERMISSION_SCHEMA[key]],
    })
  );
  const permValues = permissions as unknown as PermValues;

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <SlidersHorizontal size={22} className="text-[var(--color-accent)]" />
        Préférences
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Réglages propres à claudeboard — stockés dans{" "}
        <code className="font-mono text-[12px]">data/claudeboard.json</code>, jamais dans{" "}
        <code className="font-mono text-[12px]">~/.claude</code>.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck size={18} className="text-[var(--color-accent)]" />
          Autorisations d'écriture
        </h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">
          Ce que l'app est autorisée à créer, modifier, supprimer ou réinitialiser dans{" "}
          <code className="font-mono text-[12px]">~/.claude</code>.{" "}
          <strong>Tout est verrouillé par défaut</strong> : activez une case pour débloquer
          l'action correspondante. Plugins &amp; marketplaces restent en lecture seule
          (installation = ressort du CLI).
        </p>
        <PermissionsMatrix resources={resources} columns={ACTION_COLUMNS} initial={permValues} />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign size={18} className="text-[var(--color-accent)]" />
          Tarifs d'estimation
        </h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">
          Tarifs appliqués pour estimer le coût affiché dans le dashboard. Valeurs en USD par
          million de tokens — modifiables ci-dessous, puis « Sauvegarder ».
        </p>
        <PricingEditor
          families={families}
          cols={COLS.map((c) => ({ ...c }))}
          defaults={defaults}
          initial={initial}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wallet size={18} className="text-[var(--color-accent)]" />
          Abonnement
        </h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">
          Plan Claude retenu pour estimer la rentabilité (coût d'usage vs coût de l'abonnement)
          sur le dashboard. Détecté automatiquement depuis{" "}
          <code className="font-mono text-[12px]">~/.claude.json</code>, ou choisi manuellement
          ci-dessous.
        </p>
        <SubscriptionSelector
          initialSelection={subSelection}
          detected={{ label: sub.detected.label, known: sub.detected.known }}
          planOptions={planOptions}
        />
      </section>

      <div className="mt-10 space-y-4 text-sm text-[var(--color-muted)]">
        <div>
          <div className="eyebrow pb-1">Convention IN / OUT</div>
          <p>Partout dans le dashboard, l'affichage suit ce sens&nbsp;:</p>
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
                <strong>OUT</strong> = ce que tu reçois (la réponse générée par le modèle) —{" "}
                <em>flèche vers le bas</em>.
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
            Le prix d'écriture cache utilise le tarif TTL 1 h (celui employé par Claude Code).
            Les tokens{" "}
            <code className="rounded bg-[var(--color-code)] px-1 py-0.5 font-mono text-[12px]">
              cache_creation_input_tokens
            </code>{" "}
            sont tous facturés à ce tarif.
          </p>
        </div>

        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-[13px]">
          ⚠️ Ce sont des <strong>tarifs indicatifs</strong> servant à une estimation locale — ce
          n'est pas une facturation réelle. Les valeurs par défaut viennent de{" "}
          <code className="font-mono text-[12px]">lib/analytics.ts</code> ; les modifications
          enregistrées ici sont stockées dans{" "}
          <code className="font-mono text-[12px]">data/claudeboard.json</code> et appliquées à
          toutes les estimations. « Réinitialiser » restaure les défauts.
        </p>
      </div>
    </div>
  );
}
