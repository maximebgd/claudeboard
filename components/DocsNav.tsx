"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocMeta } from "@/lib/docs";

/**
 * Sommaire latéral des pages de doc. Le fetch FS reste côté serveur (layout) ;
 * ce composant est client uniquement pour l'état actif via `usePathname`.
 */
export default function DocsNav({ docs }: { docs: DocMeta[] }) {
  const pathname = usePathname();

  const items = [
    { href: "/docs", label: "Vue d'ensemble", exact: true },
    ...docs.map((d) => ({ href: `/docs/${d.slug}`, label: d.title, exact: false })),
  ];

  return (
    <nav className="flex flex-col gap-1">
      <div className="eyebrow px-3 pb-1">Documentation</div>
      {items.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-accent)]"
              />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
