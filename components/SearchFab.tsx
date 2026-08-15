"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Bouton d'action flottant (bas à droite de l'écran) ouvrant la recherche
 * full-text. Masqué lorsqu'on est déjà sur la page `/search`.
 */
export default function SearchFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/search")) return null;
  return (
    <Link
      href="/search"
      aria-label="Rechercher dans les transcripts"
      title="Rechercher (tous les transcripts)"
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
    >
      <Search size={20} />
    </Link>
  );
}
