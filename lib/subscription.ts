import fs from "fs/promises";
import path from "path";
import { CLAUDE_DIR } from "./claude";

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

export type PlanType = "pro" | "max5x" | "unknown";

/**
 * Prix mensuel indicatif en USD par plan — comme `PRICING` dans analytics.ts,
 * c'est une estimation locale, pas une facturation réelle.
 */
const PLAN: Record<Exclude<PlanType, "unknown">, { label: string; monthlyPriceUSD: number }> = {
  pro: { label: "Pro", monthlyPriceUSD: 20 },
  max5x: { label: "Max 5×", monthlyPriceUSD: 100 },
};

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
function planFromOrgType(orgType: unknown): PlanType {
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
    label: PLAN[type].label,
    monthlyPriceUSD: PLAN[type].monthlyPriceUSD,
    billingType,
    since: Number.isNaN(sinceMs) ? null : sinceMs,
  };
}
