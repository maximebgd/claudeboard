import fs from "fs/promises";
import { safeResolve } from "./claude";

/**
 * Limites d'usage Claude.ai (fenêtres glissantes **5 h** et **7 j**), telles
 * qu'exposées par Claude Code au script statusline via le champ `rate_limits` du
 * JSON stdin (`five_hour` / `seven_day` → `used_percentage` + `resets_at`).
 *
 * Claude Code n'écrit ces valeurs dans **aucun fichier « officiel »** : elles ne
 * sont poussées qu'au statusline. La seule copie persistée sur la machine est
 * celle que le statusline de l'utilisateur met en cache à chaque rendu, dans
 * `~/.claude/statusline-cache/rate-limits.env` (format `KEY=value`). On lit donc
 * ce cache en **LECTURE SEULE** (dans CLAUDE_DIR → `safeResolve`). Conséquences :
 *   - les valeurs datent de la **dernière session Claude Code active** (pas temps
 *     réel) ;
 *   - sans statusline alimentant ce cache, l'info est indisponible (`known:false`).
 *
 * Le statusline enregistre `BLOCK_PCT` / `RESET_EPOCH` (5 h) et `WEEK_PCT` /
 * `WEEK_RESET_EPOCH` (7 j) ; les epochs sont en **secondes**, un pct à `-1`
 * signale une valeur non encore renseignée (aucun échange API depuis le lancement).
 */

const CACHE_REL = "statusline-cache/rate-limits.env";

export interface UsageWindow {
  /** % de la limite consommé (0–100) au moment du dernier relevé. */
  usedPct: number;
  /** Epoch **ms** de reset de la fenêtre (0 si inconnu). */
  resetsAt: number;
  /** true si la fenêtre s'est déjà réinitialisée depuis le relevé (pct périmé). */
  expired: boolean;
}

export interface RateLimits {
  /** false si le cache est absent ou n'expose aucune fenêtre exploitable. */
  known: boolean;
  /** Fenêtre glissante de 5 heures. */
  fiveHour: UsageWindow;
  /** Fenêtre glissante de 7 jours. */
  sevenDay: UsageWindow;
}

/** Parse défensif d'un fichier `KEY=value` (une paire par ligne). */
function parseEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Construit une fenêtre à partir du pct brut et de l'epoch de reset (secondes). */
function toWindow(pctRaw: number, resetSec: number): UsageWindow {
  const resetsAt = Number.isFinite(resetSec) && resetSec > 0 ? resetSec * 1000 : 0;
  const expired = resetsAt > 0 && resetsAt <= Date.now();
  // pct < 0 = non renseigné ; fenêtre périmée → consommation repartie de 0.
  const usedPct =
    expired || !Number.isFinite(pctRaw) || pctRaw < 0 ? 0 : Math.min(100, Math.max(0, pctRaw));
  return { usedPct, resetsAt, expired };
}

const EMPTY: UsageWindow = { usedPct: 0, resetsAt: 0, expired: false };

export async function getRateLimits(): Promise<RateLimits> {
  let raw: string;
  try {
    raw = await fs.readFile(safeResolve(CACHE_REL), "utf8");
  } catch {
    return { known: false, fiveHour: EMPTY, sevenDay: EMPTY };
  }

  const env = parseEnv(raw);
  const blockPct = num(env.BLOCK_PCT);
  const weekPct = num(env.WEEK_PCT);
  // « connu » dès qu'au moins une fenêtre expose une valeur exploitable (>= 0).
  const known =
    (Number.isFinite(blockPct) && blockPct >= 0) || (Number.isFinite(weekPct) && weekPct >= 0);
  if (!known) return { known: false, fiveHour: EMPTY, sevenDay: EMPTY };

  return {
    known: true,
    fiveHour: toWindow(blockPct, num(env.RESET_EPOCH)),
    sevenDay: toWindow(weekPct, num(env.WEEK_RESET_EPOCH)),
  };
}
