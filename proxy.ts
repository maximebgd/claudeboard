import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Défense en profondeur : claudeboard est une app **strictement locale** (elle lit
// et écrit ~/.claude sur la machine). Le serveur est déjà lié à 127.0.0.1 dans les
// scripts npm, mais ce proxy ajoute un filet : il refuse toute requête dont l'hôte
// n'est pas une adresse de boucle locale. Si le serveur était relancé sur une autre
// interface par mégarde, un accès depuis le réseau (`<IP>:3000`) verrait son en-tête
// `Host` valoir cette IP — et serait donc rejeté ici.
//
// Note : l'en-tête `Host` est falsifiable, ce n'est donc PAS la protection primaire
// (le binding sur 127.0.0.1 l'est) ; c'est une ceinture en plus des bretelles.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function hostname(host: string | null): string | null {
  if (!host) return null;
  // IPv6 littéral : `[::1]:3000` → `::1`
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? null : host.slice(1, end);
  }
  // `127.0.0.1:3000` → `127.0.0.1`
  return host.split(":")[0];
}

export function proxy(request: NextRequest) {
  const name = hostname(request.headers.get("host"));

  if (name && LOOPBACK_HOSTS.has(name)) {
    return NextResponse.next();
  }

  return new NextResponse("Accès refusé : claudeboard est réservé à un usage local.", {
    status: 403,
  });
}

export const config = {
  // S'applique à toutes les routes (pages ET /api), sauf les assets statiques Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
