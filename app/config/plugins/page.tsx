import { Blocks, Store, Github, FolderInput, Ban } from "lucide-react";
import { getPlugins, type Marketplace } from "@/lib/plugins";
import { formatDate } from "@/lib/claude";
import Collapsible from "@/components/Collapsible";
import PluginCatalog from "@/components/PluginCatalog";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";
import { getT, type Language, type ServerI18n } from "@/lib/i18n";
import { tPlural } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

/** Format compact d'un nombre : 8157417 → « 8,1 M », 63906 → « 63,9 k ». */
function formatCompact(n: number, locale: Language): string {
  const dec = locale === "en" ? "." : ",";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", dec)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", dec)} k`;
  return n.toLocaleString(locale === "en" ? "en-US" : "fr-FR");
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function MarketplaceCard({ m, t, locale }: { m: Marketplace; t: ServerI18n["t"]; locale: Language }) {
  const available = m.plugins.filter((p) => !p.installed);
  const installed = m.plugins.filter((p) => p.installed);
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-inset)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        {m.sourceType === "github" ? (
          <Github size={16} className="text-[var(--color-faint)]" />
        ) : m.sourceType === "directory" ? (
          <FolderInput size={16} className="text-[var(--color-faint)]" />
        ) : (
          <Store size={16} className="text-[var(--color-faint)]" />
        )}
        <span className="font-medium">{m.name}</span>
        <span className="rounded bg-[var(--color-code)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
          {m.sourceType}
        </span>
        {!m.insideClaudeDir && m.installLocation && (
          <span
            title={t("mkt.externalTitle")}
            className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400"
          >
            {t("mkt.external")}
          </span>
        )}
      </div>

      {m.description && (
        <p className="mt-2 text-sm text-[var(--color-muted)]">{m.description}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-faint)]">
        {m.sourceLabel && <span className="font-mono break-all">{m.sourceLabel}</span>}
        {m.owner && <span>{t("mkt.owner", { owner: m.owner })}</span>}
        {m.lastUpdated && <span>{t("mkt.updated", { date: formatDate(m.lastUpdated, locale) })}</span>}
        <span>
          {tPlural(t, "mkt.plugins", m.plugins.length)}
          {m.installedCount > 0 && tPlural(t, "mkt.installedSuffix", m.installedCount)}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {!m.catalogFound ? (
          <p className="text-xs text-[var(--color-faint)]">{t("mkt.catalogNotFound")}</p>
        ) : m.plugins.length === 0 ? (
          <p className="text-xs text-[var(--color-faint)]">{t("mkt.emptyCatalog")}</p>
        ) : (
          <>
            {available.length > 0 && (
              <Collapsible label={t("mkt.toInstall", { count: available.length })}>
                <PluginCatalog plugins={available} marketplace={m.name} showInstall />
              </Collapsible>
            )}
            {installed.length > 0 && (
              <Collapsible label={t("mkt.installed", { count: installed.length })}>
                <PluginCatalog plugins={installed} marketplace={m.name} />
              </Collapsible>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default async function PluginsPage() {
  const {
    pluginsDir,
    configExists,
    marketplaces,
    totalMarketplaces,
    totalAvailable,
    installedCount,
    blocked,
    usage,
    totalUniqueInstalls,
    installsGeneratedAt,
  } = await getPlugins();
  const { t, locale } = await getT();

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Blocks size={22} className="text-[var(--color-accent)]" />
          {t("sidebar.plugins")}
        </h1>
        <ReadOnlyBadge />
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t("plugins.subtitle")}</p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">{pluginsDir}</p>

      {!configExists ? (
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
          {t("plugins.noMarketplaces")}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label={t("plugins.kpi.marketplaces")} value={totalMarketplaces} />
            <Kpi label={t("plugins.kpi.available")} value={totalAvailable} />
            <Kpi label={t("plugins.kpi.installed")} value={installedCount} />
            <Kpi label={t("plugins.kpi.blocked")} value={blocked.length} />
            <Kpi
              label={t("plugins.kpi.totalInstalls")}
              value={formatCompact(totalUniqueInstalls, locale)}
            />
          </div>
          {installsGeneratedAt && (
            <p className="mt-2 text-[11px] text-[var(--color-faint)]">
              {t("plugins.installsNote", { date: formatDate(installsGeneratedAt, locale) })}
            </p>
          )}

          <section className="mt-8 flex flex-col gap-4">
            {marketplaces.map((m) => (
              <MarketplaceCard key={m.name} m={m} t={t} locale={locale} />
            ))}
          </section>
        </>
      )}

      {blocked.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-medium flex items-center gap-2">
            <Ban size={18} className="text-red-400" /> {t("plugins.blockedTitle")}
          </h2>
          <div className="flex flex-col gap-2">
            {blocked.map((b) => (
              <div
                key={b.plugin}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{b.plugin}</span>
                  {b.reason && (
                    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
                      {b.reason}
                    </span>
                  )}
                  {b.addedAt && (
                    <span className="text-[11px] text-[var(--color-faint)]">
                      {formatDate(b.addedAt, locale)}
                    </span>
                  )}
                </div>
                {b.text && (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{b.text}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {usage.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-medium">{t("plugins.usageTitle")}</h2>
          <div className="flex flex-col gap-2">
            {usage.map((u) => (
              <div
                key={u.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] px-3 py-2"
              >
                <span className="font-mono text-sm">{u.key}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {tPlural(t, "plugins.usageCount", u.usageCount)}
                  {u.lastUsedAt && ` · ${formatDate(u.lastUsedAt, locale)}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
