import { Plug, Lock, Terminal, Globe } from "lucide-react";
import { getMcpServers, type McpServer } from "@/lib/mcp";
import { projectLabel } from "@/lib/projects";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";
import { getT, type ServerI18n } from "@/lib/i18n";
import { tPlural } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

function ServerCard({ s, t }: { s: McpServer; t: ServerI18n["t"] }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        {s.transport === "stdio" ? (
          <Terminal size={14} className="text-[var(--color-faint)]" />
        ) : (
          <Globe size={14} className="text-[var(--color-faint)]" />
        )}
        <span className="font-medium">{s.name}</span>
        <span className="rounded bg-[var(--color-code)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
          {s.transport}
        </span>
        {s.needsAuth && (
          <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
            <Lock size={10} /> auth
          </span>
        )}
      </div>

      <div className="mt-2 font-mono text-[12px] text-[var(--color-muted)]">
        {s.url && <div className="break-all">url: {s.url}</div>}
        {s.command && (
          <div className="break-all">
            {s.command} {s.args.join(" ")}
          </div>
        )}
        {s.cwd && <div className="break-all text-[var(--color-faint)]">cwd: {s.cwd}</div>}
        {s.envKeys.length > 0 && (
          <div className="text-[var(--color-faint)]">
            env: {s.envKeys.join(", ")}{" "}
            <span className="italic">{t("mcp.envMasked")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function McpPage() {
  const [{ configPath, configExists, global, projects, totalCount }, { t }] = await Promise.all([
    getMcpServers(),
    getT(),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Plug size={22} className="text-[var(--color-accent)]" />
          {t("sidebar.mcp")}
        </h1>
        <ReadOnlyBadge />
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {tPlural(t, "mcp.count", totalCount)} {t("mcp.readOnly")}
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">{configPath}</p>

      {!configExists && (
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
          {t("mcp.notFound")}
        </div>
      )}

      {configExists && totalCount === 0 && (
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
          {t("mcp.empty")}
        </div>
      )}

      {global.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-medium">{t("mcp.global")}</h2>
          <div className="flex flex-col gap-3">
            {global.map((s) => (
              <ServerCard key={s.name} s={s} t={t} />
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-medium">{t("mcp.perProject")}</h2>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            {t("mcp.perProjectDesc")}
          </p>
          <div className="flex flex-col gap-5">
            {projects.map((p) => (
              <div key={p.projectPath}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium text-sm">{projectLabel(p.projectPath)}</span>
                  <code className="text-[11px] text-[var(--color-faint)] font-mono">
                    {p.projectPath}
                  </code>
                </div>
                <div className="flex flex-col gap-3">
                  {p.servers.map((s) => (
                    <ServerCard key={s.name} s={s} t={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
