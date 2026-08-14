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

/**
 * Autorisations d'écriture que l'utilisateur s'accorde depuis l'UI. Chaque
 * ressource n'expose que les actions qui la concernent. **Défaut : tout `false`**
 * — rien n'est modifiable/supprimable tant que ce n'est pas activé dans la page
 * Préférences (verrou opt-in intégral). Plugins & marketplaces sont volontairement
 * absents : ils restent en lecture seule (installation = ressort du CLI).
 *
 * Ce schéma pilote à la fois les défauts, la normalisation défensive et l'UI.
 */
export const PERMISSION_SCHEMA = {
  skills: ["create", "modify", "delete"],
  projects: ["delete"], // projets & sessions
  settings: ["modify", "reset"], // Settings Claude (settings.json)
  // Les hooks vivent DANS settings.json : créer/supprimer/éditer un hook = éditer
  // ce bloc JSON. Une seule permission d'édition (pas de create/delete distincts).
  hooks: ["modify"],
  claudeMd: ["create", "modify", "delete", "reset"],
  agents: ["create", "modify", "delete"],
  commands: ["create", "modify", "delete"],
  keybindings: ["create", "modify", "delete", "reset"],
} as const;

export type PermissionResource = keyof typeof PERMISSION_SCHEMA;
export type PermissionAction = (typeof PERMISSION_SCHEMA)[PermissionResource][number];

/** Carte ressource → action → autorisée. Toutes les clés du schéma sont présentes. */
export type Permissions = {
  [R in PermissionResource]: {
    [A in (typeof PERMISSION_SCHEMA)[R][number]]: boolean;
  };
};

export interface StoreData {
  version: number;
  /** Sessions épinglées, clés « <projectId>/<sessionId> ». */
  favorites: string[];
  /** Projets épinglés, par `id` de projet (nom de dossier de ~/.claude/projects). */
  favoriteProjects: string[];
  /** Autorisations d'écriture accordées depuis l'UI (cf. PERMISSION_SCHEMA). */
  permissions: Permissions;
  /** Tarifs surchargés par famille de modèle (sinon défauts `PRICING`). */
  pricingOverrides: Record<string, PricingRow>;
  /** Plan d'abonnement retenu pour adapter l'estimation. */
  subscription: { plan: string | null; source: "auto" | "manual" };
}

/** Construit une carte de permissions toutes à la même valeur (défaut : `false`). */
function buildPermissions(value = false): Permissions {
  const out = {} as Permissions;
  for (const [resource, actions] of Object.entries(PERMISSION_SCHEMA)) {
    const row: Record<string, boolean> = {};
    for (const action of actions) row[action] = value;
    (out as Record<string, unknown>)[resource] = row;
  }
  return out;
}

function defaults(): StoreData {
  return {
    version: STORE_VERSION,
    favorites: [],
    favoriteProjects: [],
    permissions: buildPermissions(false),
    pricingOverrides: {},
    subscription: { plan: null, source: "auto" },
  };
}

/**
 * Normalise une carte de permissions inconnue sur le schéma courant : seules les
 * paires ressource/action déclarées sont retenues, chaque valeur ramenée à un
 * booléen strict (`true` uniquement si explicitement `true`). Applique aussi la
 * migration de l'ancien champ `unlockedFields` (createSkills/Agents/Commands →
 * *.create) pour les stores écrits avant l'introduction de la matrice.
 */
function normalizePermissions(raw: unknown, legacyUnlocked: unknown): Permissions {
  const perms = buildPermissions(false);
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const [resource, actions] of Object.entries(PERMISSION_SCHEMA)) {
    const row = o[resource];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    for (const action of actions) {
      if (r[action] === true) {
        (perms[resource as PermissionResource] as Record<string, boolean>)[action] = true;
      }
    }
  }
  if (legacyUnlocked && typeof legacyUnlocked === "object") {
    const u = legacyUnlocked as Record<string, unknown>;
    if (u.createSkills === true) perms.skills.create = true;
    if (u.createAgents === true) perms.agents.create = true;
    if (u.createCommands === true) perms.commands.create = true;
  }
  return perms;
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
  d.permissions = normalizePermissions(o.permissions, o.unlockedFields);
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

/**
 * Enregistre le choix d'abonnement. `source: "auto"` efface tout plan manuel (on
 * repasse sur l'auto-détection). `source: "manual"` conserve le `plan` fourni tel
 * quel — la **validation** de la valeur de plan est faite en amont (route API),
 * le store ne fait que persister. Retourne l'état écrit.
 */
export async function setSubscription(input: {
  plan: string | null;
  source: "auto" | "manual";
}): Promise<StoreData["subscription"]> {
  const source = input.source === "manual" ? "manual" : "auto";
  const plan = source === "manual" && typeof input.plan === "string" ? input.plan : null;
  await writeStore({ subscription: { plan, source } });
  return { plan, source };
}

/** Lit la carte des permissions courantes (défauts inclus si store absent). */
export async function getPermissions(): Promise<Permissions> {
  return (await readStore()).permissions;
}

/**
 * Applique un patch partiel de permissions (par ressource/action), normalisé sur
 * le schéma courant, et persiste. Retourne la carte complète résultante. Le patch
 * ne peut activer que des paires ressource/action déclarées dans PERMISSION_SCHEMA.
 */
export async function setPermissions(patch: unknown): Promise<Permissions> {
  const current = await readStore();
  const next = buildPermissions(false);
  const p = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  for (const [resource, actions] of Object.entries(PERMISSION_SCHEMA)) {
    const patchRow = p[resource];
    const pr = patchRow && typeof patchRow === "object" ? (patchRow as Record<string, unknown>) : null;
    for (const action of actions) {
      const key = action as string;
      const fromPatch = pr && key in pr ? pr[key] === true : undefined;
      const fromCurrent = (current.permissions[resource as PermissionResource] as Record<string, boolean>)[key];
      (next[resource as PermissionResource] as Record<string, boolean>)[key] =
        fromPatch !== undefined ? fromPatch : fromCurrent;
    }
  }
  await writeStore({ permissions: next });
  return next;
}

/**
 * Vérifie côté serveur qu'une action d'écriture est autorisée. À appeler dans les
 * routes API avant toute mutation. Retourne `false` si la paire n'existe pas.
 */
export async function isAllowed(
  resource: PermissionResource,
  action: PermissionAction
): Promise<boolean> {
  const perms = await getPermissions();
  const row = perms[resource] as Record<string, boolean> | undefined;
  return row?.[action] === true;
}
