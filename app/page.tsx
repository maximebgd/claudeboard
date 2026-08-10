import Link from "next/link";
import {
  Sparkles,
  FolderGit2,
  MessagesSquare,
  Coins,
  Cpu,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Wrench,
  Clock,
  Brain,
  Wallet,
} from "lucide-react";
import { CLAUDE_DIR, formatDate } from "@/lib/claude";
import { getAnalytics, MODEL_COLOR, parseModel, type ModelStat } from "@/lib/analytics";
import { getSubscription } from "@/lib/subscription";
import { listSkills } from "@/lib/skills";
import ActivityHeatmap, { type HeatDay } from "@/components/ActivityHeatmap";
import RangeSelector from "@/components/RangeSelector";

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

function fmtMonths(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
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

/* ------------------------------ range selector ---------------------------- */

const DAY_MS = 86400000;
/** Durée moyenne d'un mois (jours), pour proratiser le coût de l'abonnement. */
const MONTH_MS = 30.44 * DAY_MS;

interface ResolvedRange {
  key: string; // all | 30j | 7j | month | custom
  sinceMs: number;
  untilMs: number; // 0 = pas de borne haute
  month: string; // YYYY-MM (préremplissage)
  from: string; // YYYY-MM-DD (préremplissage)
  to: string;
}

const PRESET_DAYS: Record<string, number> = { all: 0, "30j": 30, "7j": 7 };

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** epoch ms à minuit UTC pour une date `YYYY-MM-DD`, ou NaN si invalide. */
function utcMs(day: string): number {
  return Date.parse(day + "T00:00:00Z");
}

function resolveRange(params: { [key: string]: string | string[] | undefined }): ResolvedRange {
  const key = one(params.range);

  if (key === "month") {
    const raw = one(params.month);
    const m = /^\d{4}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
    const [y, mo] = m.split("-").map(Number);
    return {
      key: "month",
      sinceMs: Date.UTC(y, mo - 1, 1),
      untilMs: Date.UTC(y, mo, 1) - 1, // fin de mois incluse
      month: m,
      from: "",
      to: "",
    };
  }

  if (key === "custom") {
    const from = one(params.from);
    const to = one(params.to);
    const okFrom = /^\d{4}-\d{2}-\d{2}$/.test(from);
    const okTo = /^\d{4}-\d{2}-\d{2}$/.test(to);
    return {
      key: "custom",
      sinceMs: okFrom ? utcMs(from) : 0,
      untilMs: okTo ? utcMs(to) + DAY_MS - 1 : 0, // jour de fin inclus
      month: "",
      from: okFrom ? from : "",
      to: okTo ? to : "",
    };
  }

  const rk = key in PRESET_DAYS ? key : "all";
  const days = PRESET_DAYS[rk];
  return {
    key: rk,
    sinceMs: days > 0 ? Date.now() - days * DAY_MS : 0,
    untilMs: 0,
    month: "",
    from: "",
    to: "",
  };
}

/* --------------------------------- StatCard ------------------------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      {/* Tick d'accent : discret au repos, s'allonge au survol (jauge d'instrument). */}
      <span className="absolute left-0 top-0 h-6 w-px bg-[var(--color-accent)]/40 transition-all group-hover:h-10 group-hover:bg-[var(--color-accent)]" />
      <div className="flex items-center gap-1.5">
        <Icon size={14} className="shrink-0 text-[var(--color-accent)]" />
        <span className="eyebrow whitespace-nowrap tracking-[0.05em]">{label}</span>
        {href && (
          <ArrowRight
            size={12}
            className="ml-auto shrink-0 text-[var(--color-faint)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-fg)]"
          />
        )}
      </div>
      <div className="mt-3 font-mono text-[1.7rem] font-medium leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1.5 font-mono text-[11px] text-[var(--color-faint)]">{sub}</div>}
    </>
  );

  const cls =
    "group relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4 transition-colors hover:border-[var(--color-accent)]/45";

  if (href) {
    return (
      <Link href={href} className={`${cls} block`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/* ------------------------------- SectionTitle ----------------------------- */

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
          <span className="font-mono text-xl font-medium tabular-nums">{fmtNum(total)}</span>
          <span className="eyebrow mt-0.5">réponses</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        {models.map((m) => {
          const pct = total > 0 ? (m.messages / total) * 100 : 0;
          return (
            <div key={m.key} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: m.color }} />
              <span className="text-[var(--color-fg)]">{m.label}</span>
              <span className="font-mono text-[var(--color-faint)] tabular-nums">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------- Page --------------------------------- */

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const range = resolveRange(await searchParams);
  const [a, skills, sub] = await Promise.all([
    getAnalytics(range.sinceMs, range.untilMs),
    listSkills(),
    getSubscription(),
  ]);

  // Nombre de mois d'abonnement facturés sur la fenêtre. La facturation est
  // mensuelle : tout mois entamé compte pour un mois plein (arrondi au sup., min 1).
  // Fenêtre bornée : durée / mois moyen (30j → 1). « Tout » : depuis le début de
  // l'abonnement (repli sur la 1re activité si la date d'abo manque).
  const firstActivityMs = a.days.length ? utcMs(a.days[0].date) : 0;
  const subMonths = (() => {
    if (range.sinceMs > 0) {
      const until = range.untilMs > 0 ? range.untilMs : Date.now();
      return Math.max(1, Math.ceil((until - range.sinceMs) / MONTH_MS));
    }
    const startMs = sub.since ?? firstActivityMs;
    return startMs > 0 ? Math.max(1, Math.ceil((Date.now() - startMs) / MONTH_MS)) : 0;
  })();
  const subCost = sub.monthlyPriceUSD * subMonths;
  const netSavings = a.totals.costUSD - subCost;

  // Bornes de la fenêtre en clés de jour UTC, pour surligner les jours concernés
  // dans la heatmap (qui, elle, reste sur l'historique complet). Pas de fenêtre = « Tout ».
  const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const hasWindow = range.sinceMs > 0;
  const windowFrom = hasWindow ? dayKey(range.sinceMs) : undefined;
  const windowTo = hasWindow ? dayKey(range.untilMs > 0 ? range.untilMs : Date.now()) : undefined;
  const { totals, session } = a;
  const maxTool = Math.max(1, ...a.topTools.map((t) => t.count));
  const totalText = totals.thinkingChars + totals.textChars;
  const thinkingPct = totalText > 0 ? (totals.thinkingChars / totalText) * 100 : 0;

  // Données de la heatmap : % et couleurs des modèles pré-calculés côté serveur
  // pour éviter d'importer lib/analytics (qui dépend de `fs`) dans le composant client.
  // La heatmap couvre tout l'historique ; certains modèles peuvent être absents de
  // l'ensemble filtré `a.models` → repli sur parseModel + couleur de famille.
  const modelMeta = new Map(a.models.map((m) => [m.key, { label: m.label, color: m.color }]));
  const heatDays: HeatDay[] = a.days.map((d) => {
    const totalAssistant = Object.values(d.models).reduce((s, n) => s + n, 0);
    const models = Object.entries(d.models)
      .sort((x, y) => y[1] - x[1])
      .map(([id, c]) => {
        const meta = modelMeta.get(id) ?? { label: parseModel(id).label, color: MODEL_COLOR[parseModel(id).family] };
        return {
          label: meta.label,
          color: meta.color,
          pct: totalAssistant > 0 ? Math.round((c / totalAssistant) * 100) : 0,
        };
      });
    return { date: d.date, sessions: d.sessions, messages: d.messages, costUSD: d.costUSD, models };
  });

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      {/* Hero « status-line » : le chemin ~/.claude traité comme un vrai prompt shell. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow flex items-center gap-2">
            <span className="text-[var(--color-accent)]">claude board</span>
            <span aria-hidden className="text-[var(--color-faint)]">/</span>
            <span>readout</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Vue d&apos;ensemble</h1>
          <p className="mt-2 flex items-center gap-2 font-mono text-sm text-[var(--color-muted)]">
            <span className="text-[var(--color-accent)]" aria-hidden>
              $
            </span>
            <span className="truncate">{CLAUDE_DIR}</span>
            <span className="cb-cursor shrink-0" aria-hidden />
          </p>
        </div>
        <RangeSelector activeKey={range.key} month={range.month} from={range.from} to={range.to} />
      </header>

      <div className="mt-6 h-px bg-gradient-to-r from-[var(--color-border)] via-[var(--color-border)] to-transparent" />

      {/* KPI */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Sparkles} label="Skills" value={fmtNum(skills.length)} href="/skills" />
        <StatCard
          icon={FolderGit2}
          label="Projets / Sessions"
          value={`${fmtNum(totals.projects)} / ${fmtNum(totals.sessions)}`}
          href="/projects"
        />
        <StatCard
          icon={MessagesSquare}
          label="Messages"
          value={full.format(totals.messages)}
          sub={
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
          }
        />
        <StatCard
          icon={Cpu}
          label="Tokens (in/out)"
          value={fmtNum(totals.tokensIn + totals.tokensOut)}
          sub={
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5">
                <ArrowDown size={12} className="text-[var(--color-accent)]" />
                {fmtNum(totals.tokensIn)} in
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <ArrowUp size={12} className="text-[var(--color-accent)]" />
                {fmtNum(totals.tokensOut)} out
              </span>
            </span>
          }
        />
        <StatCard icon={Coins} label="Coût estimé" value={fmtUSD(totals.costUSD)} sub="tarifs indicatifs" />
      </div>

      {/* Abonnement : valeur nette (coût usage estimé − prix de l'abo sur la fenêtre) */}
      <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
            <Wallet size={13} className="text-[var(--color-accent)]" />
            <h2 className="eyebrow text-[var(--color-muted)]">Abonnement</h2>
          </div>
          {sub.known && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2.5 py-1 text-sm font-medium text-[var(--color-accent)]">
                <Wallet size={14} />
                {sub.label}
              </span>
              {sub.since && (
                <span className="font-mono text-xs text-[var(--color-faint)]">depuis le {formatDate(sub.since)}</span>
              )}
              <span className="font-mono text-xs text-[var(--color-faint)]">
                {fmtUSD(sub.monthlyPriceUSD)}/mois
              </span>
            </div>
          )}
        </div>
        {!sub.known ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            Aucun abonnement Pro / Max détecté dans <code className="font-mono">~/.claude.json</code>.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="eyebrow">Coût usage estimé</div>
                <div className="mt-1 font-mono text-xl font-medium tabular-nums">{fmtUSD(a.totals.costUSD)}</div>
                <div className="mt-1 font-mono text-[11px] text-[var(--color-faint)]">sans abonnement (tarifs indicatifs)</div>
              </div>
              <div>
                <div className="eyebrow">Coût abonnement</div>
                <div className="mt-1 font-mono text-xl font-medium tabular-nums">{fmtUSD(subCost)}</div>
                <div className="mt-1 font-mono text-[11px] text-[var(--color-faint)]">
                  {fmtMonths(subMonths)} mois × {fmtUSD(sub.monthlyPriceUSD)}
                </div>
              </div>
              <div>
                <div className="eyebrow">Économie nette</div>
                <div
                  className={`mt-1 font-mono text-xl font-medium tabular-nums ${
                    netSavings >= 0 ? "text-emerald-500" : "text-red-400"
                  }`}
                >
                  {netSavings >= 0 ? "+" : "−"}
                  {fmtUSD(Math.abs(netSavings))}
                </div>
                <div className="mt-1 font-mono text-[11px] text-[var(--color-faint)]">
                  {netSavings >= 0 ? "gagné grâce à l'abonnement" : "l'abonnement coûte plus que l'usage"}
                </div>
              </div>
          </div>
        )}
      </section>

      {/* Heatmap */}
      <section className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
        <ActivityHeatmap
          days={heatDays}
          windowFrom={windowFrom}
          windowTo={windowTo}
          title={<SectionTitle>Activité · 12 derniers mois</SectionTitle>}
        />
      </section>

      {/* Modèles : camembert + tokens/coût */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle>Répartition des modèles</SectionTitle>
          {a.models.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Aucune donnée de modèle.</p>
          ) : (
            <Donut models={a.models} />
          )}
        </section>

        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle>Tokens &amp; coût par modèle</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left eyebrow">
                  <th className="pb-2 font-normal">Modèle</th>
                  <th className="pb-2 text-right font-normal">In</th>
                  <th className="pb-2 text-right font-normal">Out</th>
                  <th className="pb-2 text-right font-normal">Cache</th>
                  <th className="pb-2 text-right font-normal">Coût</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {a.models.map((m) => (
                  <tr key={m.key} className="border-t border-[var(--color-border)]">
                    <td className="py-2 font-sans">
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
                  <td className="py-2 font-sans">Total</td>
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
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle icon={Wrench}>Outils &amp; skills les plus utilisés</SectionTitle>
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
                  <span className="w-12 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                    {fmtNum(t.count)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle icon={Clock}>Sessions</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <div className="eyebrow">Messages / session</div>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums">{session.avgMessages.toFixed(1)}</div>
            </div>
            <div>
              <div className="eyebrow">Outils appelés</div>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums">{fmtNum(totals.toolUses)}</div>
            </div>
            <div>
              <div className="eyebrow">Durée moyenne</div>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums">{fmtDuration(session.avgDurationMs)}</div>
            </div>
            <div>
              <div className="eyebrow">Durée médiane</div>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums">{fmtDuration(session.medianDurationMs)}</div>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Brain size={13} className="text-[var(--color-accent)]" />
                Ratio thinking / texte
              </span>
              <span className="font-mono tabular-nums">{thinkingPct.toFixed(0)}% thinking</span>
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
        <SectionTitle icon={FolderGit2}>Projets récemment modifiés</SectionTitle>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] divide-y divide-[var(--color-border)]">
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
