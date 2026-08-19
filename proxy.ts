import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Garde réseau pour une app **strictement locale** (claudeboard lit et écrit ~/.claude
// sur la machine, sans auth). Le serveur est déjà lié à 127.0.0.1 dans les scripts npm ;
// ce proxy ajoute deux ceintures indispensables, appliquées avant toute route :
//
//  1. Host loopback (toutes méthodes) — filet anti-DNS-rebinding et anti-écoute réseau :
//     si le serveur repartait par mégarde sur une autre interface, un accès depuis le
//     réseau (`<IP>:port`) verrait son en-tête `Host` valoir cette IP → rejeté. Idem si
//     `attacker.com` résout vers 127.0.0.1 (rebinding) : le `Host` reste `attacker.com`.
//
//  2. Origin loopback (méthodes mutantes) — protection anti-CSRF, la protection qui
//     *manquait*. Les routes font `req.json()` sans vérifier le `Content-Type` : un
//     `<form enctype="text/plain">` cross-origin est une « simple request » (aucun
//     preflight CORS) et se connecte réellement à 127.0.0.1 (donc `Host` valide, la
//     ceinture #1 ne suffit pas). Sans auth, ce POST activerait toutes les permissions
//     via /api/store puis écrirait un hook shell via /api/hooks = exécution de code au
//     prochain lancement de Claude Code. On exige donc une `Origin` (ou `Referer`) dont
//     l'hôte est la boucle locale ; une origine tierce — ou absente — est refusée.
//
// Note : `Host`/`Origin` sont falsifiables hors navigateur, ce ne sont donc PAS les
// protections primaires (le binding 127.0.0.1 l'est) ; mais dans un navigateur ils sont
// posés par l'agent et non contrôlables par le site attaquant — d'où leur efficacité ici.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Méthodes qui modifient l'état → exigent une origine loopback vérifiée. */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

/** Extrait le hostname d'un en-tête `Host` (`127.0.0.1:9400` / `[::1]:9400`). */
function hostname(host: string | null): string | null {
  if (!host) return null;
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? null : host.slice(1, end); // IPv6 littéral
  }
  return host.split(":")[0];
}

function isLoopbackHost(host: string | null): boolean {
  const name = hostname(host);
  return !!name && LOOPBACK_HOSTS.has(name);
}

/** Hostname de l'origine effective (`Origin`, sinon `Referer`), ou null si absent/illisible. */
function originHostname(req: NextRequest): string | null {
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!source) return null;
  try {
    return new URL(source).hostname;
  } catch {
    return null;
  }
}

function deny(message: string): NextResponse {
  return new NextResponse(message, { status: 403 });
}

export function proxy(request: NextRequest) {
  // 1. Anti-rebinding / anti-réseau : le Host doit être la boucle locale.
  if (!isLoopbackHost(request.headers.get("host"))) {
    return deny("Accès refusé : claudeboard est réservé à un usage local.");
  }

  // 2. Anti-CSRF : sur une méthode mutante, l'origine doit être présente et loopback.
  if (MUTATING.has(request.method)) {
    const originHost = originHostname(request);
    if (!originHost || !LOOPBACK_HOSTS.has(originHost)) {
      return deny("Requête cross-origin refusée : same-origin uniquement.");
    }
  }

  return NextResponse.next();
}

export const config = {
  // S'applique à toutes les routes (pages ET /api), sauf les assets statiques Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
