/**
 * Cycles de **facturation** de l'abonnement — isomorphe (aucune I/O, bundlable
 * client). Un abonnement facturé le 23 court du 23 d'un mois au 23 du suivant ;
 * ce module dérive ces bornes à partir de la date de souscription (`anchorMs`,
 * cf. `subscription.ts`) pour alimenter le range `?range=cycle&cycle=<offset>`.
 *
 * Tout est calé en **UTC** (comme le range « Mois » de la page). Le jour d'ancrage
 * est le jour du mois de la souscription, **borné** à la longueur du mois (un abo
 * le 31 tombe le 30/28 les mois plus courts).
 */

export interface BillingCycle {
  /** epoch ms — minuit UTC du début de cycle (jour d'ancrage borné). */
  startMs: number;
  /** epoch ms — dernier instant du cycle (début du cycle suivant − 1 ms). */
  endMs: number;
  /** Nombre de cycles avant le cycle courant (0 = courant, 1 = précédent, …). */
  offset: number;
}

/** Borne de cycle dans (year, month0), jour d'ancrage borné à la fin de mois. */
function boundary(anchorDay: number, year: number, month0: number): number {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Date.UTC(year, month0, Math.min(anchorDay, lastDay));
}

/** (year, month0) du mois où débute le cycle **courant** à `nowMs`. */
function currentCycleMonth(anchorDay: number, nowMs: number): { year: number; month0: number } {
  const now = new Date(nowMs);
  let year = now.getUTCFullYear();
  let month0 = now.getUTCMonth();
  // Avant le jour d'ancrage de ce mois → le cycle a commencé le mois précédent.
  if (nowMs < boundary(anchorDay, year, month0)) {
    month0 -= 1;
    if (month0 < 0) {
      month0 = 11;
      year -= 1;
    }
  }
  return { year, month0 };
}

/**
 * Cycle situé `offset` cycles avant le cycle courant (0 = courant). Les bornes sont
 * calculées de façon cohérente (début = jour d'ancrage borné, fin = début du cycle
 * suivant − 1 ms), robustes aux mois courts et aux passages d'année.
 */
export function billingCycle(anchorMs: number, offset: number, nowMs: number): BillingCycle {
  const anchorDay = new Date(anchorMs).getUTCDate();
  const cur = currentCycleMonth(anchorDay, nowMs);
  const total = cur.year * 12 + cur.month0 - offset;
  const year = Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  const next = total + 1;
  const ny = Math.floor(next / 12);
  const nm = ((next % 12) + 12) % 12;
  return {
    startMs: boundary(anchorDay, year, month0),
    endMs: boundary(anchorDay, ny, nm) - 1,
    offset,
  };
}

/**
 * Les `count` cycles les plus récents (courant d'abord), sans jamais remonter avant
 * la souscription : on s'arrête au cycle qui contient `anchorMs`.
 */
export function recentCycles(anchorMs: number, nowMs: number, count: number): BillingCycle[] {
  const out: BillingCycle[] = [];
  for (let i = 0; i < count; i++) {
    const c = billingCycle(anchorMs, i, nowMs);
    out.push(c);
    if (c.startMs <= anchorMs) break; // ce cycle contient la souscription → dernier
  }
  return out;
}
