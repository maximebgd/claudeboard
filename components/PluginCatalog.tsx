"use client";

import { useMemo, useState } from "react";
import { Search, CheckCircle2, Ban, ExternalLink, Copy, Check, Download } from "lucide-react";
import type { MarketplacePluginEntry } from "@/lib/plugins";
import { useTranslation } from "@/components/I18nProvider";
import { tPlural } from "@/lib/i18n/core";
import type { Language } from "@/lib/i18n/core";

/** Formate un nombre d'installs (1636 → « 1 636 », 63906 → « 63,9 k »). */
function formatInstalls(n: number, locale: Language): string {
  const dec = locale === "en" ? "." : ",";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", dec)} k`;
  return n.toLocaleString(locale === "en" ? "en-US" : "fr-FR");
}

/** Commande CLI pour installer un plugin depuis sa marketplace. */
function installCommand(name: string, marketplace: string) {
  return `/plugin install ${name}@${marketplace}`;
}

/** Commande CLI pour désinstaller un plugin. */
function uninstallCommand(name: string, marketplace: string) {
  return `/plugin uninstall ${name}@${marketplace}`;
}

function CopyCommand({ command }: { command: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible — on ignore */
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="flex-1 truncate rounded bg-[var(--color-code)] px-2 py-1 font-mono text-[11px] text-[var(--color-muted)]">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        title={t("resume.copyCommand")}
        className="flex items-center gap-1 rounded border border-[var(--color-border)] px-1.5 py-1 text-[10px] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? t("resume.copied") : t("resume.copy")}
      </button>
    </div>
  );
}

function PluginRow({
  p,
  marketplace,
  showInstall,
}: {
  p: MarketplacePluginEntry;
  marketplace: string;
  showInstall: boolean;
}) {
  const { t, locale } = useTranslation();
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">{p.name}</span>
        {p.category && (
          <span className="rounded bg-[var(--color-code)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
            {p.category}
          </span>
        )}
        {p.installed && (
          <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
            <CheckCircle2 size={10} /> {t("plugin.installed")}
          </span>
        )}
        {p.blocked && (
          <span
            title={p.blockReason ?? undefined}
            className="flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400"
          >
            <Ban size={10} /> {t("plugin.blocked")}
          </span>
        )}
        {p.author && (
          <span className="text-[11px] text-[var(--color-faint)]">{t("plugin.by", { author: p.author })}</span>
        )}
        {p.uniqueInstalls != null && (
          <span
            title={t("plugin.installsTitle", { count: p.uniqueInstalls.toLocaleString(locale === "en" ? "en-US" : "fr-FR") })}
            className="ml-auto flex items-center gap-1 rounded bg-[var(--color-code)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
          >
            <Download size={10} /> {formatInstalls(p.uniqueInstalls, locale)}
          </span>
        )}
      </div>
      {p.description && (
        <p className="mt-1.5 text-xs text-[var(--color-muted)] line-clamp-3">{p.description}</p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--color-faint)]">
        {p.sourceLabel && <span className="break-all">{p.sourceLabel}</span>}
        {p.homepage && (
          <a
            href={p.homepage}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[var(--color-accent)] hover:underline"
          >
            <ExternalLink size={10} /> homepage
          </a>
        )}
      </div>
      {p.installed ? (
        <CopyCommand command={uninstallCommand(p.name, marketplace)} />
      ) : (
        showInstall &&
        !p.blocked && <CopyCommand command={installCommand(p.name, marketplace)} />
      )}
    </div>
  );
}

/**
 * Catalogue de plugins d'une marketplace : recherche + zone scrollable qui
 * n'affiche qu'environ 4 plugins à la fois (le reste est accessible au scroll).
 *
 * `showInstall` affiche la commande d'installation sous chaque plugin (utilisé
 * pour le catalogue des plugins non installés).
 */
export default function PluginCatalog({
  plugins,
  marketplace,
  showInstall = false,
}: {
  plugins: MarketplacePluginEntry[];
  marketplace: string;
  showInstall?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter((p) =>
      [p.name, p.description, p.category, p.author]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(q))
    );
  }, [plugins, query]);

  return (
    <div className="pt-1">
      <div className="relative mb-2">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("plugin.searchPlaceholder")}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 py-3 text-xs text-[var(--color-faint)]">{t("plugin.noMatch")}</p>
      ) : (
        <div className="max-h-[22rem] overflow-y-auto flex flex-col gap-2 pr-1">
          {filtered.map((p) => (
            <PluginRow key={p.name} p={p} marketplace={marketplace} showInstall={showInstall} />
          ))}
        </div>
      )}

      <div className="mt-1.5 px-1 text-[10px] text-[var(--color-faint)]">
        {tPlural(t, "plugin.footer", plugins.length, { filtered: filtered.length, total: plugins.length })}
      </div>
    </div>
  );
}
