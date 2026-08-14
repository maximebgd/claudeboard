"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  FolderGit2,
  Settings,
  Webhook,
  Bot,
  SquareSlash,
  FileText,
  Plug,
  Blocks,
  Keyboard,
  SlidersHorizontal,
  BookOpen,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

// Groupe principal (haut, sans titre) puis la section Config regroupant les
// réglages et références (Préférences claudeboard en tête, avant les fichiers ~/.claude).
const SECTIONS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
      { href: "/skills", label: "Skills", icon: Sparkles },
      { href: "/projects", label: "Projets & Sessions", icon: FolderGit2 },
    ],
  },
  {
    label: "Config",
    items: [
      { href: "/config/claude-md", label: "CLAUDE.md", icon: FileText },
      { href: "/config/agents", label: "Agents", icon: Bot },
      { href: "/config/commands", label: "Commandes", icon: SquareSlash },
      { href: "/config/settings", label: "Settings Claude", icon: Settings },
      { href: "/config/hooks", label: "Hooks", icon: Webhook },
      { href: "/config/mcp", label: "MCP servers", icon: Plug },
      { href: "/config/plugins", label: "Plugins & Marketplaces", icon: Blocks },
      { href: "/config/keybindings", label: "Keybindings", icon: Keyboard },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] font-mono text-sm font-bold text-[var(--color-accent)]">
            ›_
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight tracking-tight">Claude Board</div>
            <div className="font-mono text-[11px] leading-tight text-[var(--color-muted)]">~/.claude</div>
          </div>
        </div>
      </div>
      <nav className="p-3 flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
        {SECTIONS.map((section, si) => (
          <div key={section.label ?? si} className="flex flex-col gap-1">
            {section.label && (
              <div className="eyebrow px-3 pb-1 pt-5">{section.label}</div>
            )}
            {section.items.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
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
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex items-center justify-between p-3">
        <ThemeToggle />
        <div className="flex items-center gap-1">
          <Link
            href="/config/preferences"
            aria-label="Préférences"
            title="Préférences"
            className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname.startsWith("/config/preferences")
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
            }`}
          >
            <SlidersHorizontal size={16} />
          </Link>
          <Link
            href="/docs"
            aria-label="Documentation"
            title="Documentation"
            className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname.startsWith("/docs")
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
            }`}
          >
            <BookOpen size={16} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
