import Link from "next/link";
import {
  Sparkles,
  FolderGit2,
  MessagesSquare,
  Coins,
  Cpu,
  ArrowRight,
  Wrench,
  Clock,
  Brain,
} from "lucide-react";
import { CLAUDE_DIR, formatDate } from "@/lib/claude";
import { getAnalytics, type ModelStat } from "@/lib/analytics";
import ActivityHeatmap, { type HeatDay } from "@/components/ActivityHeatmap";

export const dynamic = "force-dynamic";

/* --------------------------------- helpers -------------------------------- */

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("fr-FR");

function fmtNum(n: number): string {
  return n >= 10000 ? compact.format(n) : full.format(n);
}

function fmtUSD(n: number): string {
  if (n > 0 && n < 0.01) return "< 0,01 $";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${m.toString().padStart(2, "0")}`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

/* --------------------------------- StatCard ------------------------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-muted)]">
        <Icon size={15} className="text-[var(--color-accent)]" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-[var(--color-faint)]">{sub}</div>}
    </div>
  );
}

/* ---------------------------------- Donut --------------------------------- */

function Donut({ models }: { models: ModelStat[] }) {
  const total = models.reduce((n, m) => n + m.messages, 0);
  const R = 15.9155; // circonférence ≈ 100 → dasharray en %
  let acc = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r={R} fill="none" stroke="var(--color-inset)" strokeWidth="5" />
          {total > 0 &&
            models.map((m) => {
              const pct = (m.messages / total) * 100;
              if (pct <= 0) return null;
              const seg = (
                <circle
                  key={m.key}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={m.color}
                  strokeWidth="5"
                  strokeDasharray={`${pct} ${100 - pct}`}
                  strokeDashoffset={-acc}
                />
              );
              acc += pct;
              return seg;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">{fmtNum(total)}</span>
          <span className="text-[10px] text-[var(--color-muted)]">réponses</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        {models.map((m) => {
          const pct = total > 0 ? (m.messages / total) * 100 : 0;
          return (
            <div key={m.key} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: m.color }} />
              <span className="text-[var(--color-fg)]">{m.label}</span>
              <span className="text-[var(--color-faint)] tabular-nums">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------- Page --------------------------------- */

export default async function HomePage() {
  const a = await getAnalytics();
  const { totals, session } = a;
  const maxTool = Math.max(1, ...a.topTools.map((t) => t.count));
  const totalText = totals.thinkingChars + totals.textChars;
  const thinkingPct = totalText > 0 ? (totals.thinkingChars / totalText) * 100 : 0;

  // Données de la heatmap : % et couleurs des modèles pré-calculés côté serveur
  // pour éviter d'importer lib/analytics (qui dépend de `fs`) dans le composant client.
  const modelMeta = new Map(a.models.map((m) => [m.key, { label: m.label, color: m.color }]));
  const heatDays: HeatDay[] = a.days.map((d) => {
    const totalAssistant = Object.values(d.models).reduce((s, n) => s + n, 0);
    const models = Object.entries(d.models)
      .sort((x, y) => y[1] - x[1])
      .map(([id, c]) => {
        const meta = modelMeta.get(id);
        return {
          label: meta?.label ?? id,
          color: meta?.color ?? "#71717a",
          pct: totalAssistant > 0 ? Math.round((c / totalAssistant) * 100) : 0,
        };
      });
    return { date: d.date, sessions: d.sessions, messages: d.messages, models };
  });

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold">Vue d&apos;ensemble</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)] font-mono">{CLAUDE_DIR}</p>

      {/* KPI */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={FolderGit2} label="Projets" value={fmtNum(totals.projects)} />
        <StatCard icon={MessagesSquare} label="Sessions" value={fmtNum(totals.sessions)} />
        <StatCard icon={MessagesSquare} label="Messages" value={fmtNum(totals.messages)} />
        <StatCard
          icon={Cpu}
          label="Tokens (in/out)"
          value={fmtNum(totals.tokensIn + totals.tokensOut)}
          sub={`${fmtNum(totals.tokensIn)} in · ${fmtNum(totals.tokensOut)} out`}
        />
        <StatCard icon={Coins} label="Coût estimé" value={fmtUSD(totals.costUSD)} sub="tarifs indicatifs" />
      </div>

      {/* Heatmap */}
      <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium">Activité (12 derniers mois)</h2>
          <span className="text-xs text-[var(--color-faint)]">
            survolez un jour pour le détail des modèles
          </span>
        </div>
        <ActivityHeatmap days={heatDays} />
      </section>

      {/* Modèles : camembert + tokens/coût */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <h2 className="text-sm font-medium mb-4">Répartition des modèles</h2>
          {a.models.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Aucune donnée de modèle.</p>
          ) : (
            <Donut models={a.models} />
          )}
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <h2 className="text-sm font-medium mb-4">Tokens &amp; coût par modèle</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-muted)]">
                  <th className="font-normal pb-2">Modèle</th>
                  <th className="font-normal pb-2 text-right">In</th>
                  <th className="font-normal pb-2 text-right">Out</th>
                  <th className="font-normal pb-2 text-right">Cache</th>
                  <th className="font-normal pb-2 text-right">Coût</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {a.models.map((m) => (
                  <tr key={m.key} className="border-t border-[var(--color-border)]">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: m.color }} />
                        {m.label}
                      </span>
                    </td>
                    <td className="py-2 text-right">{fmtNum(m.tokensIn)}</td>
                    <td className="py-2 text-right">{fmtNum(m.tokensOut)}</td>
                    <td className="py-2 text-right text-[var(--color-muted)]">{fmtNum(m.cacheRead + m.cacheWrite)}</td>
                    <td className="py-2 text-right">{fmtUSD(m.costUSD)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--color-border)] font-medium">
                  <td className="py-2">Total</td>
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
      </div>

      {/* Top outils + stats sessions */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={15} className="text-[var(--color-accent)]" />
            <h2 className="text-sm font-medium">Outils &amp; skills les plus utilisés</h2>
          </div>
          {a.topTools.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Aucun appel d&apos;outil.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {a.topTools.map((t) => (
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
                  <span className="w-12 text-right text-sm tabular-nums text-[var(--color-muted)]">
                    {fmtNum(t.count)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-[var(--color-accent)]" />
            <h2 className="text-sm font-medium">Sessions</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-[var(--color-muted)]">Messages / session</div>
              <div className="text-xl font-semibold tabular-nums">{session.avgMessages.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)]">Outils appelés</div>
              <div className="text-xl font-semibold tabular-nums">{fmtNum(totals.toolUses)}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)]">Durée moyenne</div>
              <div className="text-xl font-semibold tabular-nums">{fmtDuration(session.avgDurationMs)}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)]">Durée médiane</div>
              <div className="text-xl font-semibold tabular-nums">{fmtDuration(session.medianDurationMs)}</div>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Brain size={13} className="text-[var(--color-accent)]" />
                Ratio thinking / texte
              </span>
              <span className="tabular-nums">{thinkingPct.toFixed(0)}% thinking</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--color-inset)]">
              <div className="h-full bg-[var(--color-accent)]" style={{ width: `${thinkingPct}%` }} />
              <div className="h-full bg-[var(--color-faint)]" style={{ width: `${100 - thinkingPct}%` }} />
            </div>
          </div>
        </section>
      </div>

      {/* Projets récents */}
      <section className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <FolderGit2 size={15} className="text-[var(--color-accent)]" />
          <h2 className="text-sm font-medium">Projets récemment modifiés</h2>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] divide-y divide-[var(--color-border)]">
          {a.recentProjects.length === 0 && (
            <div className="p-4 text-sm text-[var(--color-muted)]">Aucun projet trouvé.</div>
          )}
          {a.recentProjects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${encodeURIComponent(p.id)}`}
              className="group flex items-center gap-3 p-4 hover:bg-[var(--color-hover)] transition-colors"
            >
              <FolderGit2 size={15} className="text-[var(--color-accent)] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {p.sessionCount} session{p.sessionCount > 1 ? "s" : ""} · {formatDate(p.lastModified)}
                </div>
              </div>
              <ArrowRight
                size={16}
                className="text-[var(--color-faint)] group-hover:text-[var(--color-fg)] transition-colors shrink-0"
              />
            </Link>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <Link href="/skills" className="inline-flex items-center gap-1.5 text-[var(--color-accent)] hover:underline">
            <Sparkles size={14} /> Voir les skills
          </Link>
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-[var(--color-accent)] hover:underline">
            <FolderGit2 size={14} /> Tous les projets
          </Link>
        </div>
      </section>
    </div>
  );
}
