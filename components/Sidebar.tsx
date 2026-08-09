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
  Keyboard,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/projects", label: "Projets & Sessions", icon: FolderGit2 },
];

const CONFIG_NAV = [
  { href: "/config/settings", label: "Settings", icon: Settings },
  { href: "/config/hooks", label: "Hooks", icon: Webhook },
  { href: "/config/agents", label: "Agents", icon: Bot },
  { href: "/config/commands", label: "Commandes", icon: SquareSlash },
  { href: "/config/claude-md", label: "CLAUDE.md", icon: FileText },
  { href: "/config/mcp", label: "MCP servers", icon: Plug },
  { href: "/config/keybindings", label: "Keybindings", icon: Keyboard },
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
      <nav className="p-3 flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
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

        <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
          Config
        </div>
        {CONFIG_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
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
