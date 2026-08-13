import fs from "fs/promises";
import path from "path";
import { CLAUDE_DIR } from "./claude";
import { readStore } from "./store";

/**
 * Lecture SEULE du type d'abonnement Claude. Comme la config MCP, cette info vit
 * dans `~/.claude.json` — HORS de CLAUDE_DIR, dans un fichier qui contient aussi
 * des secrets (oauth, caches). On ne lit donc QUE l'objet `oauthAccount`, et on
 * n'en extrait que des champs non sensibles (type d'orga, type de facturation,
 * date de souscription). Aucun token / uuid / secret n'est exposé.
 *
 * Voir l'exception documentée pour `lib/mcp.ts` dans AGENTS.md — même modèle.
 */

/** `~/.claude.json` — sibling de CLAUDE_DIR (respecte un override CLAUDE_DIR). */
const CLAUDE_JSON = path.join(path.dirname(CLAUDE_DIR), ".claude.json");

export type PlanType = "pro" | "max5x" | "max20x" | "none" | "unknown";

/** Plans payants sélectionnables (avec leur prix). Sert au calcul et à l'UI. */
export type PaidPlan = "pro" | "max5x" | "max20x";

/**
 * Prix mensuel indicatif en USD par plan — comme `PRICING` dans analytics.ts,
 * c'est une estimation locale, pas une facturation réelle.
 */
export const PLANS: Record<PaidPlan, { label: string; monthlyPriceUSD: number }> = {
  pro: { label: "Pro", monthlyPriceUSD: 20 },
  max5x: { label: "Max 5×", monthlyPriceUSD: 100 },
  max20x: { label: "Max 20×", monthlyPriceUSD: 200 },
};

/** Valeurs de plan acceptées pour un choix **manuel** (plans payants + « aucun »). */
export const MANUAL_PLAN_VALUES = ["pro", "max5x", "max20x", "none"] as const;
export type ManualPlan = (typeof MANUAL_PLAN_VALUES)[number];

export function isManualPlan(v: unknown): v is ManualPlan {
  return typeof v === "string" && (MANUAL_PLAN_VALUES as readonly string[]).includes(v);
}

export interface Subscription {
  configPath: string;
  configExists: boolean;
  /** true si un plan payant connu (Pro / Max 5×) a pu être déterminé. */
  known: boolean;
  type: PlanType;
  label: string;
  /** Prix mensuel estimé (USD) ; 0 si plan inconnu. */
  monthlyPriceUSD: number;
  /** Type de facturation brut (`stripe_subscription`, …) ou null. */
  billingType: string | null;
  /** Début de l'abonnement en ms epoch, ou null si absent. */
  since: number | null;
}

/** Mappe `organizationType` (Anthropic) vers un plan connu. */
function planFromOrgType(orgType: unknown): "pro" | "max5x" | "unknown" {
  if (orgType === "claude_pro") return "pro";
  if (orgType === "claude_max") return "max5x";
  return "unknown";
}

export async function getSubscription(): Promise<Subscription> {
  const base: Subscription = {
    configPath: CLAUDE_JSON,
    configExists: false,
    known: false,
    type: "unknown",
    label: "Inconnu",
    monthlyPriceUSD: 0,
    billingType: null,
    since: null,
  };

  let account: Record<string, unknown> | null = null;
  try {
    const raw = await fs.readFile(CLAUDE_JSON, "utf8");
    base.configExists = true;
    const parsed = JSON.parse(raw);
    const acc = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).oauthAccount : null;
    if (acc && typeof acc === "object") account = acc as Record<string, unknown>;
  } catch {
    /* fichier absent ou illisible */
  }
  if (!account) return base;

  const type = planFromOrgType(account.organizationType);
  const billingType = typeof account.billingType === "string" ? account.billingType : null;
  const sinceStr = typeof account.subscriptionCreatedAt === "string" ? account.subscriptionCreatedAt : null;
  const sinceMs = sinceStr ? Date.parse(sinceStr) : NaN;

  if (type === "unknown") {
    return { ...base, billingType, since: Number.isNaN(sinceMs) ? null : sinceMs };
  }

  return {
    ...base,
    known: true,
    type,
    label: PLANS[type].label,
    monthlyPriceUSD: PLANS[type].monthlyPriceUSD,
    billingType,
    since: Number.isNaN(sinceMs) ? null : sinceMs,
  };
}

export interface EffectiveSubscription extends Subscription {
  /** Comment `type`/prix ont été décidés : détection auto ou choix manuel de l'UI. */
  source: "auto" | "manual";
  /** Résultat brut de l'auto-détection, conservé pour l'UI même en mode manuel. */
  detected: { type: PlanType; label: string; known: boolean };
}

/**
 * Abonnement **effectif** = auto-détection (`getSubscription`) éventuellement
 * remplacée par le choix manuel enregistré dans le store claudeboard. C'est cet
 * abonnement qui pilote le calcul de rentabilité (coût usage vs coût abonnement).
 * En mode manuel, on garde la date de souscription/facturation auto-détectée (info
 * indicative), mais le plan et le prix viennent du choix de l'utilisateur.
 */
export async function getEffectiveSubscription(): Promise<EffectiveSubscription> {
  const auto = await getSubscription();
  const detected = { type: auto.type, label: auto.label, known: auto.known };
  const { subscription } = await readStore();

  if (subscription.source === "manual" && isManualPlan(subscription.plan)) {
    const plan = subscription.plan;
    if (plan === "none") {
      return { ...auto, known: false, type: "none", label: "Aucun", monthlyPriceUSD: 0, source: "manual", detected };
    }
    return {
      ...auto,
      known: true,
      type: plan,
      label: PLANS[plan].label,
      monthlyPriceUSD: PLANS[plan].monthlyPriceUSD,
      source: "manual",
      detected,
    };
  }

  return { ...auto, source: "auto", detected };
}
