import Link from "next/link";
import {
  ArrowLeft,
  MessagesSquare,
  ChevronRight,
  Coins,
  Cpu,
  Wrench,
  FolderGit2,
  CalendarDays,
  ArrowDown,
  ArrowUp,
  Clock,
  History,
} from "lucide-react";
import { listSessions, listProjects, projectLabel } from "@/lib/projects";
import { getProjectStats } from "@/lib/analytics";
import { formatDate, formatSize, formatDuration, formatRelative } from "@/lib/claude";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";

export const dynamic = "force-dynamic";

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("fr-FR");

function fmtNum(n: number): string {
  return n >= 10000 ? compact.format(n) : full.format(n);
}

function fmtUSD(n: number): string {
  if (n > 0 && n < 0.01) return "< 0,01 $";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

/** Jour compact « 8 août » (sans année) pour les cartes KPI étroites. */
function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Heure « 20:50 ». */
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  valueClassName = "text-[1.4rem] leading-none",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      <span className="absolute left-0 top-0 h-6 w-px bg-[var(--color-accent)]/40" />
      <div className="flex items-center gap-1.5">
        <Icon size={14} className="shrink-0 text-[var(--color-accent)]" />
        <span className="eyebrow whitespace-nowrap tracking-[0.05em]">{label}</span>
      </div>
      <div className={`mt-3 font-mono font-medium tabular-nums ${valueClassName}`}>{value}</div>
      {sub && <div className="mt-1.5 font-mono text-[11px] text-[var(--color-faint)]">{sub}</div>}
    </div>
  );
}

function SectionTitle({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
      {Icon && <Icon size={13} className="text-[var(--color-accent)]" />}
      <h2 className="eyebrow text-[var(--color-muted)]">{children}</h2>
    </div>
  );
}

export default async function ProjectSessionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const [sessions, projects, stats] = await Promise.all([
    listSessions(id),
    listProjects(),
    getProjectStats(id),
  ]);
  const project = projects.find((p) => p.id === id);
  const { totals } = stats;
  const maxTool = Math.max(1, ...stats.topTools.map((t) => t.count));
  const hasActivity = stats.firstActivity > 0;
  const hasRange = hasActivity && stats.firstActivity !== stats.lastActivity;
  const activityValue = hasActivity ? (
    <span className="flex flex-col leading-tight">
      <span>{fmtDay(stats.lastActivity)}</span>
      <span>{fmtTime(stats.lastActivity)}</span>
    </span>
  ) : (
    "—"
  );
  const activitySub = hasRange ? (
    <span className="flex flex-col">
      <span>depuis le {fmtDay(stats.firstActivity)}</span>
      <span>{fmtTime(stats.firstActivity)}</span>
    </span>
  ) : undefined;

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft size={15} /> Projets
      </Link>

      <div className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {project ? projectLabel(project.realPath) : id}
          </h1>
          <ReadOnlyBadge />
        </div>
        {project && (
          <>
            <p className="mt-1 text-xs text-[var(--color-muted)] font-mono">{project.realPath}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-faint)]">
              <span className="flex items-center gap-1" title={`Créé le ${formatDate(project.createdAt)}`}>
                <Clock size={12} />
                Existe depuis {formatDuration(Date.now() - project.createdAt)}
              </span>
              <span className="flex items-center gap-1" title={formatDate(project.lastModified)}>
                <History size={12} />
                Modifié {formatRelative(project.lastModified)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* KPI du projet */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Stat
          icon={FolderGit2}
          label="Sessions"
          value={fmtNum(totals.sessions)}
          sub={
            <span className="flex flex-col gap-0.5">
              <span>{fmtNum(totals.messages)} messages</span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-0.5">
                  <ArrowUp size={12} className="text-[var(--color-accent)]" />
                  {fmtNum(totals.userMessages)}
                </span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <ArrowDown size={12} className="text-[var(--color-accent)]" />
                  {fmtNum(totals.assistantMessages)}
                </span>
              </span>
            </span>
          }
        />
        <Stat
          icon={Cpu}
          label="Tokens (in/out)"
          value={fmtNum(totals.tokensIn + totals.tokensOut)}
          sub={
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5">
                <ArrowUp size={12} className="text-[var(--color-accent)]" />
                {fmtNum(totals.tokensIn)}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <ArrowDown size={12} className="text-[var(--color-accent)]" />
                {fmtNum(totals.tokensOut)}
              </span>
            </span>
          }
        />
        <Stat icon={Coins} label="Coût estimé" value={fmtUSD(totals.costUSD)} sub="tarifs indicatifs" />
        <Stat icon={Wrench} label="Outils appelés" value={fmtNum(totals.toolUses)} />
        <Stat
          icon={CalendarDays}
          label="Activité"
          value={activityValue}
          sub={activitySub}
          valueClassName="text-[1.4rem] leading-none"
        />
      </div>

      {/* Modèles utilisés */}
      {stats.models.length > 0 && (
        <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle icon={Cpu}>Modèles utilisés</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left eyebrow">
                  <th className="pb-2 font-normal">Modèle</th>
                  <th className="pb-2 text-right font-normal">Msg</th>
                  <th className="pb-2 text-right font-normal">
                    <span className="inline-flex items-center gap-0.5">
                      <ArrowUp size={12} className="text-[var(--color-accent)]" />
                      In
                    </span>
                  </th>
                  <th className="pb-2 text-right font-normal">
                    <span className="inline-flex items-center gap-0.5">
                      <ArrowDown size={12} className="text-[var(--color-accent)]" />
                      Out
                    </span>
                  </th>
                  <th className="pb-2 text-right font-normal">Cache</th>
                  <th className="pb-2 text-right font-normal">Coût</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {stats.models.map((m) => (
                  <tr key={m.key} className="border-t border-[var(--color-border)]">
                    <td className="py-2 font-sans">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: m.color }} />
                        {m.label}
                      </span>
                    </td>
                    <td className="py-2 text-right">{fmtNum(m.messages)}</td>
                    <td className="py-2 text-right">{fmtNum(m.tokensIn)}</td>
                    <td className="py-2 text-right">{fmtNum(m.tokensOut)}</td>
                    <td className="py-2 text-right text-[var(--color-muted)]">
                      {fmtNum(m.cacheRead + m.cacheWrite)}
                    </td>
                    <td className="py-2 text-right">{fmtUSD(m.costUSD)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--color-border)] font-medium">
                  <td className="py-2 font-sans">Total</td>
                  <td className="py-2 text-right">{fmtNum(totals.assistantMessages)}</td>
                  <td className="py-2 text-right">{fmtNum(totals.tokensIn)}</td>
                  <td className="py-2 text-right">{fmtNum(totals.tokensOut)}</td>
                  <td className="py-2 text-right text-[var(--color-muted)]">
                    {fmtNum(totals.cacheRead + totals.cacheWrite)}
                  </td>
                  <td className="py-2 text-right">{fmtUSD(totals.costUSD)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Outils les plus utilisés */}
      {stats.topTools.length > 0 && (
        <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle icon={Wrench}>Outils &amp; skills les plus utilisés</SectionTitle>
          <div className="flex flex-col gap-2">
            {stats.topTools.map((t) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm font-mono" title={t.name}>
                  {t.name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-[var(--color-inset)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${(t.count / maxTool) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                  {fmtNum(t.count)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sessions */}
      <div className="mt-8">
        <SectionTitle icon={MessagesSquare}>Sessions · {full.format(sessions.length)}</SectionTitle>
        <div className="flex flex-col gap-3">
          {sessions.length === 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
              Aucune session.
            </div>
          )}
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/projects/${encodeURIComponent(id)}/${encodeURIComponent(s.id)}`}
              className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-accent)]/50 transition-colors flex items-center gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{s.title}</div>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--color-faint)]">
                  <span className="flex items-center gap-1">
                    <MessagesSquare size={12} />
                    {s.messageCount} messages
                  </span>
                  <span>{formatDate(s.lastModified)}</span>
                  <span>{formatSize(s.size)}</span>
                  <code className="text-[var(--color-faint)]">{s.id.slice(0, 8)}</code>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="text-[var(--color-faint)] group-hover:text-[var(--color-fg)] shrink-0"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
