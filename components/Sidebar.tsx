"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, FolderGit2 } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/projects", label: "Projets & Sessions", icon: FolderGit2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-[var(--color-accent)] flex items-center justify-center text-black font-bold text-sm">
            C
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">Claudeboard</div>
            <div className="text-[11px] text-[var(--color-muted)] leading-tight">~/.claude</div>
          </div>
        </div>
      </div>
      <nav className="p-3 flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-3">
        <ThemeToggle />
        <div className="px-3 pt-2 text-[11px] text-[var(--color-faint)]">
          Lecture + édition locale
        </div>
      </div>
    </aside>
  );
}
