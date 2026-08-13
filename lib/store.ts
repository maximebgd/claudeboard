import fs from "fs/promises";
import path from "path";

/**
 * État applicatif **propre à claudeboard** (favoris, préférences d'UI, overrides
 * de tarifs, plan d'abonnement) — distinct de la config Claude de ~/.claude. Ces
 * données n'appartiennent pas à Claude Code : on les stocke dans un unique JSON
 * **hors** du sandbox CLAUDE_DIR, à la racine du projet (`data/claudeboard.json`,
 * gitignored). Surchargeable via STORE_DIR (tests). Le dossier est créé à la
 * première écriture ; l'écriture est atomique (fichier temporaire puis rename).
 */
const STORE_DIR = process.env.STORE_DIR || path.join(process.cwd(), "data");
const STORE_PATH = path.join(STORE_DIR, "claudeboard.json");

/** Version du schéma — permet une future migration sans casse. */
export const STORE_VERSION = 1;

export interface PricingRow {
  in: number;
  out: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface StoreData {
  version: number;
  /** Sessions épinglées, clés « <projectId>/<sessionId> ». */
  favorites: string[];
  /** Projets épinglés, par `id` de projet (nom de dossier de ~/.claude/projects). */
  favoriteProjects: string[];
  /** Champs normalement en lecture seule dont la création est autorisée depuis l'UI. */
  unlockedFields: {
    createSkills: boolean;
    createAgents: boolean;
    createCommands: boolean;
  };
  /** Tarifs surchargés par famille de modèle (sinon défauts `PRICING`). */
  pricingOverrides: Record<string, PricingRow>;
  /** Plan d'abonnement retenu pour adapter l'estimation. */
  subscription: { plan: string | null; source: "auto" | "manual" };
}

function defaults(): StoreData {
  return {
    version: STORE_VERSION,
    favorites: [],
    favoriteProjects: [],
    unlockedFields: { createSkills: false, createAgents: false, createCommands: false },
    pricingOverrides: {},
    subscription: { plan: null, source: "auto" },
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizePricing(raw: Record<string, unknown>): Record<string, PricingRow> {
  const out: Record<string, PricingRow> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== "object") continue;
    const r = val as Record<string, unknown>;
    const inV = num(r.in);
    const outV = num(r.out);
    const cw = num(r.cacheWrite);
    const cr = num(r.cacheRead);
    if (inV === null || outV === null || cw === null || cr === null) continue;
    out[key] = { in: inV, out: outV, cacheWrite: cw, cacheRead: cr };
  }
  return out;
}

/**
 * Fusionne défensivement un objet inconnu (fichier potentiellement partiel ou
 * d'un schéma antérieur) sur les valeurs par défaut. Ne jette jamais.
 */
function normalize(raw: unknown): StoreData {
  const d = defaults();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;

  if (Array.isArray(o.favorites)) {
    d.favorites = o.favorites.filter((x): x is string => typeof x === "string");
  }
  if (Array.isArray(o.favoriteProjects)) {
    d.favoriteProjects = o.favoriteProjects.filter((x): x is string => typeof x === "string");
  }
  if (o.unlockedFields && typeof o.unlockedFields === "object") {
    const u = o.unlockedFields as Record<string, unknown>;
    d.unlockedFields = {
      createSkills: u.createSkills === true,
      createAgents: u.createAgents === true,
      createCommands: u.createCommands === true,
    };
  }
  if (o.pricingOverrides && typeof o.pricingOverrides === "object") {
    d.pricingOverrides = normalizePricing(o.pricingOverrides as Record<string, unknown>);
  }
  if (o.subscription && typeof o.subscription === "object") {
    const s = o.subscription as Record<string, unknown>;
    d.subscription = {
      plan: typeof s.plan === "string" ? s.plan : null,
      source: s.source === "manual" ? "manual" : "auto",
    };
  }
  return d;
}

/** Lit l'état ; renvoie les valeurs par défaut si le fichier est absent ou cassé. */
export async function readStore(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

/**
 * Applique un patch partiel (fusion au niveau des clés de premier niveau) et écrit
 * de façon atomique. Retourne le nouvel état.
 */
export async function writeStore(patch: Partial<StoreData>): Promise<StoreData> {
  const current = await readStore();
  const next: StoreData = { ...current, ...patch, version: STORE_VERSION };
  await fs.mkdir(STORE_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
  await fs.rename(tmp, STORE_PATH);
  return next;
}

/** Bascule la présence d'une clé dans un champ tableau du store (favoris). */
async function toggleIn(
  field: "favorites" | "favoriteProjects",
  key: string
): Promise<{ favorited: boolean }> {
  const store = await readStore();
  const set = new Set(store[field]);
  const favorited = !set.has(key);
  if (favorited) set.add(key);
  else set.delete(key);
  await writeStore({ [field]: [...set] });
  return { favorited };
}

/** Bascule l'épinglage d'une session (clé « <projectId>/<sessionId> »). */
export function toggleFavorite(key: string): Promise<{ favorited: boolean }> {
  return toggleIn("favorites", key);
}

/** Bascule l'épinglage d'un projet (par `id` de projet). */
export function toggleFavoriteProject(id: string): Promise<{ favorited: boolean }> {
  return toggleIn("favoriteProjects", id);
}

/** Familles de modèle dont le tarif est surchargeable depuis l'UI (« autre » exclu). */
export const OVERRIDABLE_FAMILIES = ["opus", "sonnet", "haiku", "fable"] as const;

/**
 * Remplace les overrides de tarifs. Chaque entrée est normalisée (les valeurs non
 * numériques sont rejetées) et seules les familles surchargeables sont conservées.
 * Écrit l'ensemble en une passe (les familles absentes retombent sur les défauts).
 */
export async function setPricingOverrides(
  raw: Record<string, unknown>
): Promise<Record<string, PricingRow>> {
  const normalized = normalizePricing(raw);
  const overrides: Record<string, PricingRow> = {};
  for (const fam of OVERRIDABLE_FAMILIES) {
    if (normalized[fam]) overrides[fam] = normalized[fam];
  }
  await writeStore({ pricingOverrides: overrides });
  return overrides;
}
