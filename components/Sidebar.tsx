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
  Wallet,
  Share2,
  Trash2,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { useTranslation } from "@/components/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/core";
import { logoSrc } from "@/lib/logos";
import type { LogoPreference } from "@/lib/store";

type NavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

// Groupe principal (haut, sans titre) puis la section Config regroupant les
// réglages et références (Préférences claudeboard en tête, avant les fichiers ~/.claude).
const SECTIONS: { labelKey?: TranslationKey; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", labelKey: "sidebar.overview", icon: LayoutDashboard, exact: true },
      { href: "/skills", labelKey: "sidebar.skills", icon: Sparkles },
      { href: "/projects", labelKey: "sidebar.projects", icon: FolderGit2 },
    ],
  },
  {
    labelKey: "sidebar.config",
    items: [
      { href: "/config/claude-md", labelKey: "sidebar.claudeMd", icon: FileText },
      { href: "/config/agents", labelKey: "sidebar.agents", icon: Bot },
      { href: "/config/commands", labelKey: "sidebar.commands", icon: SquareSlash },
      { href: "/config/graph", labelKey: "sidebar.graph", icon: Share2 },
      { href: "/config/settings", labelKey: "sidebar.settings", icon: Settings },
      { href: "/config/hooks", labelKey: "sidebar.hooks", icon: Webhook },
      { href: "/config/mcp", labelKey: "sidebar.mcp", icon: Plug },
      { href: "/config/plugins", labelKey: "sidebar.plugins", icon: Blocks },
      { href: "/config/keybindings", labelKey: "sidebar.keybindings", icon: Keyboard },
    ],
  },
];

export default function Sidebar({
  subscription,
  logo: logoPref,
}: {
  subscription: { label: string; known: boolean };
  logo: LogoPreference;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col">
      <div className="py-5 pl-5 pr-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] font-mono text-sm font-bold text-[var(--color-accent)]">
            {logoPref.mode === "on" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc(logoPref.selected)} alt="Claude Board" className="h-5 w-5" />
            ) : (
              "›_"
            )}
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight tracking-tight">
              Claude Board
            </div>
            <div className="font-mono text-[11px] leading-tight text-[var(--color-muted)]">
              ~/.claude
            </div>
          </div>
          <span
            title={t("sidebar.subscription")}
            className={`ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${
              subscription.known
                ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-muted)]"
            }`}
          >
            {/* <Wallet size={12} /> */}
            {subscription.label}
          </span>
        </div>
      </div>
      <nav className="p-3 flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
        {SECTIONS.map((section, si) => (
          <div key={section.labelKey ?? si} className="flex flex-col gap-1">
            {section.labelKey && (
              <div className="eyebrow px-3 pb-1 pt-5">{t(section.labelKey)}</div>
            )}
            {section.items.map(({ href, labelKey, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname.startsWith(href);
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
                  {t(labelKey)}
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
            aria-label={t("sidebar.preferences")}
            title={t("sidebar.preferences")}
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
            aria-label={t("sidebar.docs")}
            title={t("sidebar.docs")}
            className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname.startsWith("/docs")
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
            }`}
          >
            <BookOpen size={16} />
          </Link>
        </div>
        <Link
          href="/config/trash"
          aria-label={t("sidebar.trash")}
          title={t("sidebar.trash")}
          className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname.startsWith("/config/trash")
              ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              : "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
          }`}
        >
          <Trash2 size={16} />
        </Link>
      </div>
    </aside>
  );
}
