import { DollarSign, Wallet, SlidersHorizontal, ShieldCheck, LayoutDashboard, Languages } from "lucide-react";
import {
  PRICING,
  getEffectivePricing,
  MODEL_LABEL,
  MODEL_COLOR,
  type ModelFamily,
} from "@/lib/analytics";
import { getEffectiveSubscription, PLANS } from "@/lib/subscription";
import { getPermissions, getPreferences, PERMISSION_SCHEMA, type PermissionResource } from "@/lib/store";
import PricingEditor from "@/components/PricingEditor";
import SubscriptionSelector from "@/components/SubscriptionSelector";
import CostModeSelector from "@/components/CostModeSelector";
import LanguageSelector from "@/components/LanguageSelector";
import { getT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/core";
import PermissionsMatrix, {
  type ResourceMeta,
  type ActionMeta,
  type PermValues,
} from "@/components/PermissionsMatrix";

export const dynamic = "force-dynamic";

// Familles affichées/éditables (on masque « autre », dont tous les tarifs valent 0).
const FAMILIES: ModelFamily[] = ["opus", "sonnet", "haiku", "fable"];

const COL_KEYS = ["in", "out", "cacheWrite", "cacheRead"] as const;

// Colonnes de la matrice (union ordonnée des actions ; delete/reset sont destructives).
const ACTION_COLS: { key: string; labelKey: TranslationKey; destructive?: boolean }[] = [
  { key: "create", labelKey: "perm.col.create" },
  { key: "modify", labelKey: "perm.col.modify" },
  { key: "delete", labelKey: "perm.col.delete", destructive: true },
  { key: "reset", labelKey: "perm.col.reset", destructive: true },
  { key: "empty", labelKey: "perm.col.empty", destructive: true },
];

// Libellé + clé de description par ressource (l'ordre suit PERMISSION_SCHEMA).
const RESOURCE_META: Record<PermissionResource, { labelKey: TranslationKey; descKey: TranslationKey }> = {
  skills: { labelKey: "sidebar.skills", descKey: "perm.res.skills.desc" },
  projects: { labelKey: "sidebar.projects", descKey: "perm.res.projects.desc" },
  claudeMd: { labelKey: "sidebar.claudeMd", descKey: "perm.res.claudeMd.desc" },
  agents: { labelKey: "sidebar.agents", descKey: "perm.res.agents.desc" },
  commands: { labelKey: "sidebar.commands", descKey: "perm.res.commands.desc" },
  settings: { labelKey: "sidebar.settings", descKey: "perm.res.settings.desc" },
  hooks: { labelKey: "sidebar.hooks", descKey: "perm.res.hooks.desc" },
  keybindings: { labelKey: "sidebar.keybindings", descKey: "perm.res.keybindings.desc" },
  trash: { labelKey: "sidebar.trash", descKey: "perm.res.trash.desc" },
};

export default async function PreferencesPage() {
  const [effective, sub, permissions, preferences, { t }] = await Promise.all([
    getEffectivePricing(),
    getEffectiveSubscription(),
    getPermissions(),
    getPreferences(),
    getT(),
  ]);

  const families = FAMILIES.map((fam) => ({
    key: fam,
    label: MODEL_LABEL[fam],
    color: MODEL_COLOR[fam],
  }));
  const defaults = Object.fromEntries(FAMILIES.map((fam) => [fam, PRICING[fam]]));
  const initial = Object.fromEntries(FAMILIES.map((fam) => [fam, effective[fam]]));
  const COLS = COL_KEYS.map((key) => ({
    key,
    label: t(`pricing.col.${key}` as TranslationKey),
    hint: t(`pricing.col.${key}.hint` as TranslationKey),
  }));
  const ACTION_COLUMNS: ActionMeta[] = ACTION_COLS.map((c) => ({
    key: c.key,
    label: t(c.labelKey),
    destructive: c.destructive,
  }));

  const planOptions = [
    ...Object.entries(PLANS).map(([value, p]) => ({
      value,
      label: p.label,
      price: t("prefs.planPrice", { price: p.monthlyPriceUSD }),
    })),
    { value: "none", label: t("sub.none"), price: "—" },
  ];
  const subSelection = sub.source === "manual" ? sub.type : "auto";

  const resources: ResourceMeta[] = (Object.keys(PERMISSION_SCHEMA) as PermissionResource[]).map(
    (key) => ({
      key,
      label: t(RESOURCE_META[key].labelKey),
      description: t(RESOURCE_META[key].descKey),
      actions: [...PERMISSION_SCHEMA[key]],
    })
  );
  const permValues = permissions as unknown as PermValues;

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <SlidersHorizontal size={22} className="text-[var(--color-accent)]" />
        {t("sidebar.preferences")}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {t("prefs.introA")}{" "}
        <code className="font-mono text-[12px]">data/claudeboard.json</code>{t("prefs.introB")}{" "}
        <code className="font-mono text-[12px]">~/.claude</code>.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Languages size={18} className="text-[var(--color-accent)]" />
          {t("prefs.language.title")}
        </h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">{t("prefs.language.desc")}</p>
        <LanguageSelector initial={preferences.language} />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck size={18} className="text-[var(--color-accent)]" />
          {t("prefs.permTitle")}
        </h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">
          {t("prefs.permDescA")}{" "}
          <code className="font-mono text-[12px]">~/.claude</code>. {t("prefs.permDescB")}
        </p>
        <PermissionsMatrix resources={resources} columns={ACTION_COLUMNS} initial={permValues} />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign size={18} className="text-[var(--color-accent)]" />
          {t("prefs.pricingTitle")}
        </h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">{t("prefs.pricingDesc")}</p>
        <PricingEditor
          families={families}
          cols={COLS.map((c) => ({ ...c }))}
          defaults={defaults}
          initial={initial}
        />
        <p className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-[13px] text-[var(--color-muted)]">
          {t("prefs.pricingWarn")}
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wallet size={18} className="text-[var(--color-accent)]" />
          {t("common.subscription")}
        </h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">
          {t("prefs.subDescA")}{" "}
          <code className="font-mono text-[12px]">~/.claude.json</code>{t("prefs.subDescB")}
        </p>
        <SubscriptionSelector
          initialSelection={subSelection}
          detected={{ label: sub.detected.label, known: sub.detected.known }}
          planOptions={planOptions}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutDashboard size={18} className="text-[var(--color-accent)]" />
          {t("prefs.displayTitle")}
        </h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">{t("prefs.displayDesc")}</p>
        <CostModeSelector initial={preferences.costCardMode} />
      </section>
    </div>
  );
}
