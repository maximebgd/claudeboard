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
  Clock,
  History,
  Brain,
  Minus,
  Star,
  Wallet,
} from "lucide-react";
import { CLAUDE_DIR, formatDate, formatDuration, formatRelative } from "@/lib/claude";
import { getAnalytics, MODEL_COLOR, parseModel } from "@/lib/analytics";
import { getEffectiveSubscription } from "@/lib/subscription";
import { getRateLimits } from "@/lib/rateLimits";
import { getPreferences } from "@/lib/store";
import { getT, type Language } from "@/lib/i18n";
import { tPlural } from "@/lib/i18n/core";
import { makeFormatters } from "@/lib/format";
import { listSkills } from "@/lib/skills";
import { type HeatDay } from "@/components/ActivityHeatmap";
import ActivityPanel from "@/components/ActivityPanel";
import ModelDonut from "@/components/ModelDonut";
import RangeSelector from "@/components/RangeSelector";
// import SubscriptionCard from "@/components/SubscriptionCard"; // désormais affiché en survol de « Coût estimé »
import CostStatCard from "@/components/CostStatCard";
import ProjectCostList from "@/components/ProjectCostList";
import ToolUsageList from "@/components/ToolUsageList";
import HourlyDistribution from "@/components/HourlyDistribution";
import UsageLimits from "@/components/UsageLimits";
import FavoriteButton from "@/components/FavoriteButton";
import { getFavoriteSessions } from "@/lib/favorites";

export const dynamic = "force-dynamic";

/* --------------------------------- helpers -------------------------------- */

function fmtDuration(ms: number, locale: Language): string {
  const dU = locale === "en" ? "d" : "j";
  if (ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}${dU} ${(h % 24).toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}min`;
  }
  if (h > 0) return `${h} h ${m.toString().padStart(2, "0")}`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

/* ------------------------------ range selector ---------------------------- */

const DAY_MS = 86400000;

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

/**
 * Fenêtre **précédente** (N-1) : même durée, calée juste avant la fenêtre courante.
 * Renvoie `0, 0` (comparaison désactivée) pour la fenêtre « Tout » (pas de borne basse)
 * ou si la période précédente déborderait avant l'époque.
 */
function previousWindow(sinceMs: number, untilMs: number): { prevSinceMs: number; prevUntilMs: number } {
  if (sinceMs <= 0) return { prevSinceMs: 0, prevUntilMs: 0 };
  const winEnd = untilMs > 0 ? untilMs : Date.now();
  const len = winEnd - sinceMs;
  const prevUntilMs = sinceMs - 1;
  const prevSinceMs = prevUntilMs - len;
  return prevSinceMs > 0 ? { prevSinceMs, prevUntilMs } : { prevSinceMs: 0, prevUntilMs: 0 };
}

/** Jour au format « 13 juil. » (UTC, cohérent avec les clés de jour de la heatmap). */
function fmtDay(ms: number, locale: Language): string {
  const tag = locale === "en" ? "en-US" : "fr-FR";
  return new Date(ms).toLocaleDateString(tag, { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Libellé « du 13 juil. au 11 août » d'une période bornée. */
function rangeLabel(
  sinceMs: number,
  untilMs: number,
  locale: Language,
  t: (key: "dash.rangeLabel", params: { from: string; to: string }) => string
): string {
  return t("dash.rangeLabel", { from: fmtDay(sinceMs, locale), to: fmtDay(untilMs, locale) });
}

/** Variation en % de `cur` vs `prev`. `null` = pas de base (période N-1 vide). */
function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? null : 0;
  return ((cur - prev) / prev) * 100;
}

/**
 * Nombre de prélèvements mensuels de l'abonnement tombant dans la fenêtre
 * `[winStart, winEnd]`. L'abo est facturé chaque mois à la date anniversaire de
 * `anchorMs` (souscription) ; on compte ces échéances, bornées à maintenant.
 * `winStart = 0` (fenêtre « Tout ») = pas de borne basse.
 */
function billedMonths(anchorMs: number, winStart: number, winEnd: number): number {
  if (anchorMs <= 0) return 0;
  const end = Math.min(winEnd, Date.now());
  if (anchorMs > end) return 0;
  let count = 0;
  const d = new Date(anchorMs);
  while (d.getTime() <= end) {
    if (d.getTime() >= winStart) count++;
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return count;
}

/* --------------------------------- StatCard ------------------------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  href,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  /** Delta de vélocité (vs période précédente), affiché sous le `sub`. */
  trend?: React.ReactNode;
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
      {trend}
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

/* -------------------------------- TrendDelta ------------------------------ */

/**
 * Delta de vélocité affiché sous un KPI : `↑ +23 %` (hausse verte, baisse accent,
 * stable atténué) puis « vs du … au … » sur la ligne suivante. `pct = null` (période
 * précédente vide) → « nouveau ».
 */
function TrendDelta({
  pct,
  compareLabel,
  newLabel,
}: {
  pct: number | null;
  compareLabel: string;
  newLabel: string;
}) {
  const up = pct !== null && pct > 0;
  const down = pct !== null && pct < 0;
  const color = up ? "#6bbf73" : down ? "var(--color-accent)" : "var(--color-faint)";
  const Arrow = up ? ArrowUp : down ? ArrowDown : Minus;
  const text = pct === null ? newLabel : `${pct > 0 ? "+" : ""}${pct.toFixed(0)} %`;
  return (
    <div className="mt-1.5 text-[11px] leading-tight">
      <span className="inline-flex items-center gap-0.5 font-mono font-medium tabular-nums" style={{ color }}>
        <Arrow size={12} />
        {text}
      </span>
      <div className="text-[var(--color-faint)]">vs {compareLabel}</div>
    </div>
  );
}

/* ------------------------------- SectionTitle ----------------------------- */

function SectionTitle({
  children,
  icon: Icon,
  action,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[var(--color-accent)]" />
      {Icon && <Icon size={13} className="text-[var(--color-accent)]" />}
      <h2 className="eyebrow text-[var(--color-muted)]">{children}</h2>
      {action && <div className="ml-auto">{action}</div>}
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
  const { prevSinceMs, prevUntilMs } = previousWindow(range.sinceMs, range.untilMs);
  const [a, skills, sub, favorites, preferences, rateLimits, { t, locale }] = await Promise.all([
    getAnalytics(range.sinceMs, range.untilMs, prevSinceMs, prevUntilMs),
    listSkills(),
    getEffectiveSubscription(),
    getFavoriteSessions(),
    getPreferences(),
    getRateLimits(),
    getT(),
  ]);
  const fmt = makeFormatters(locale);

  // Nombre de mois d'abonnement facturés sur la fenêtre : on compte les échéances
  // mensuelles depuis le début de l'abonnement (repli sur la 1re activité si la date
  // d'abo manque). Une fenêtre entièrement avant la souscription → 0 mois.
  const firstActivityMs = a.days.length ? utcMs(a.days[0].date) : 0;
  const anchorMs = sub.since ?? firstActivityMs;
  const winEnd = range.untilMs > 0 ? range.untilMs : Date.now();
  const subMonths = sub.known ? billedMonths(anchorMs, range.sinceMs, winEnd) : 0;
  const subCost = sub.monthlyPriceUSD * subMonths;
  const netSavings = a.totals.costUSD - subCost;

  // Bornes de la fenêtre en clés de jour UTC, pour surligner les jours concernés
  // dans la heatmap (qui, elle, reste sur l'historique complet). Pas de fenêtre = « Tout ».
  const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const hasWindow = range.sinceMs > 0;
  const windowFrom = hasWindow ? dayKey(range.sinceMs) : undefined;
  const windowTo = hasWindow ? dayKey(range.untilMs > 0 ? range.untilMs : Date.now()) : undefined;
  // Skills les plus récemment modifiés (`listSkills` renvoie trié par nom → on re-trie
  // par date pour la colonne « récents »). Les deux colonnes affichent au plus 5 lignes,
  // le reste étant accessible par scroll (voir les conteneurs `max-h-…` ci-dessous).
  const recentSkills = [...skills].sort((x, y) => y.updatedAt - x.updatedAt);

  const { totals, session } = a;
  // Classement « Coût par projet » : on ne garde que les projets à coût non nul.
  // Recherche, tri et scroll sont gérés côté client (ProjectCostList).
  const projectCosts = a.projectCosts.filter((p) => p.costUSD > 0);
  const totalText = totals.thinkingChars + totals.textChars;
  const thinkingPct = totalText > 0 ? (totals.thinkingChars / totalText) * 100 : 0;

  // Vélocité : delta de chaque KPI vs la période précédente (N-1), affiché directement
  // dans la carte KPI correspondante. `a.trend` est `null` pour la fenêtre « Tout »
  // (pas de période de comparaison) → aucun delta n'est rendu.
  const tr = a.trend;
  const compareLabel = tr ? rangeLabel(prevSinceMs, prevUntilMs, locale, t) : "";
  const newLabel = t("dash.new");
  const messagesTrend = tr && (
    <TrendDelta pct={pctChange(totals.messages, tr.messages)} compareLabel={compareLabel} newLabel={newLabel} />
  );
  const tokensTrend = tr && (
    <TrendDelta
      pct={pctChange(totals.tokensIn + totals.tokensOut, tr.tokensIn + tr.tokensOut)}
      compareLabel={compareLabel}
      newLabel={newLabel}
    />
  );
  const costTrend = tr && (
    <TrendDelta pct={pctChange(totals.costUSD, tr.costUSD)} compareLabel={compareLabel} newLabel={newLabel} />
  );

  // Détail de l'abonnement, désormais révélé au survol de la carte « Coût estimé »
  // (auparavant une section `SubscriptionCard` dédiée). Compare le coût d'usage estimé
  // au prix de l'abonnement sur la fenêtre pour afficher l'économie nette.
  const netPositive = netSavings >= 0;
  const subTooltip = (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-2">
        <Wallet size={13} className="text-[var(--color-accent)]" />
        <span className="eyebrow text-[var(--color-muted)]">{t("common.subscription")}</span>
      </div>
      {sub.known ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
              <Wallet size={12} />
              {sub.label}
            </span>
            <span className="font-mono text-[11px] text-[var(--color-faint)]">
              {fmt.usd(sub.monthlyPriceUSD)}{t("dash.perMonth")}
            </span>
            {sub.since && (
              <span className="font-mono text-[11px] text-[var(--color-faint)]">
                {t("dash.since", { date: formatDate(sub.since, locale) })}
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3 text-center">
            <div>
              <div className="eyebrow">{t("dash.usage")}</div>
              <div className="mt-1 font-mono text-sm font-medium tabular-nums">{fmt.usd(totals.costUSD)}</div>
            </div>
            <div>
              <div className="eyebrow">{t("common.subscription")}</div>
              <div className="mt-1 font-mono text-sm font-medium tabular-nums">{fmt.usd(subCost)}</div>
              <div className="mt-0.5 font-mono text-[10px] text-[var(--color-faint)]">{t("dash.subMonths", { count: subMonths })}</div>
            </div>
            <div>
              <div className="eyebrow">{t("dash.net")}</div>
              <div
                className={`mt-1 font-mono text-sm font-medium tabular-nums ${
                  netPositive ? "text-emerald-500" : "text-red-400"
                }`}
              >
                {netPositive ? "+" : "−"}
                {fmt.usd(Math.abs(netSavings))}
              </div>
            </div>
          </div>
          {/* <div className="mt-2 font-mono text-[10px] text-[var(--color-faint)]">
            {netPositive ? "gagné grâce à l'abonnement" : "l'abonnement coûte plus que l'usage"}
          </div> */}
        </>
      ) : (
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          {t("dash.noSubDetected")} <code className="font-mono">~/.claude.json</code>.
        </p>
      )}
    </div>
  );

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
            <span aria-hidden className="text-[var(--color-faint)]">
              /
            </span>
            <span>readout</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {t("dash.title")}
          </h1>
          <p className="mt-2 flex items-center gap-2 font-mono text-sm text-[var(--color-muted)]">
            <span className="text-[var(--color-accent)]" aria-hidden>
              $
            </span>
            <span className="truncate">{CLAUDE_DIR}</span>
            <span className="cb-cursor shrink-0" aria-hidden />
          </p>
        </div>
        <RangeSelector
          activeKey={range.key}
          month={range.month}
          from={range.from}
          to={range.to}
        />
      </header>

      <div className="mt-6 h-px bg-gradient-to-r from-[var(--color-border)] via-[var(--color-border)] to-transparent" />

      {/* KPI */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={Sparkles}
          label={t("sidebar.skills")}
          value={fmt.num(skills.length)}
          href="/skills"
        />
        <StatCard
          icon={FolderGit2}
          label={t("dash.projectsSessions")}
          value={`${fmt.num(totals.projects)} / ${fmt.num(totals.sessions)}`}
          href="/projects"
        />
        <StatCard
          icon={MessagesSquare}
          label={t("dash.messages")}
          value={fmt.int(totals.messages)}
          sub={
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5">
                <ArrowUp size={12} className="text-[var(--color-accent)]" />
                {fmt.num(totals.userMessages)}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <ArrowDown size={12} className="text-[var(--color-accent)]" />
                {fmt.num(totals.assistantMessages)}
              </span>
            </span>
          }
          trend={messagesTrend}
        />
        <StatCard
          icon={Cpu}
          label={t("dash.tokens")}
          value={fmt.num(totals.tokensIn + totals.tokensOut)}
          sub={
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5">
                <ArrowUp size={12} className="text-[var(--color-accent)]" />
                {fmt.num(totals.tokensIn)}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <ArrowDown size={12} className="text-[var(--color-accent)]" />
                {fmt.num(totals.tokensOut)}
              </span>
            </span>
          }
          trend={tokensTrend}
        />
        <CostStatCard
          usageValue={fmt.usd(totals.costUSD)}
          savingsValue={fmt.usd(Math.abs(netSavings))}
          netPositive={netPositive}
          known={sub.known}
          initialSavings={preferences.costCardMode === "savings"}
          usageSub={t("dash.indicativePricing")}
          trend={costTrend}
          tooltip={subTooltip}
        />
      </div>

      {/* Limites d'usage Claude.ai (fenêtres 5 h / 7 j) — lues du cache du statusline. */}
      {rateLimits.known && (
        <section className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <UsageLimits
            known={rateLimits.known}
            fiveHour={rateLimits.fiveHour}
            sevenDay={rateLimits.sevenDay}
          />
        </section>
      )}

      {/* Abonnement : désormais révélé au survol de la carte KPI « Coût estimé » ci-dessus.
      <SubscriptionCard
        known={sub.known}
        label={sub.label}
        sinceLabel={sub.since ? formatDate(sub.since) : null}
        monthlyPrice={fmt.usd(sub.monthlyPriceUSD)}
        usageCost={fmt.usd(totals.costUSD)}
        subCost={fmt.usd(subCost)}
        months={subMonths}
        netPositive={netSavings >= 0}
        netAbs={fmt.usd(Math.abs(netSavings))}
      /> */}

      {/* Sessions épinglées */}
      {/* {favorites.length > 0 && (
        <section className="mt-8">
          <SectionTitle icon={Star}>Sessions épinglées</SectionTitle>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] divide-y divide-[var(--color-border)]">
            {favorites.map((f) => (
              <div
                key={f.key}
                className="group flex items-center gap-3 p-4 hover:bg-[var(--color-hover)] transition-colors"
              >
                <Link
                  href={`/projects/${encodeURIComponent(f.projectId)}/${encodeURIComponent(f.sessionId)}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <Star size={15} className="shrink-0 fill-[var(--color-accent)] text-[var(--color-accent)]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{f.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-faint)]">
                      <span className="flex items-center gap-1">
                        <FolderGit2 size={12} />
                        {f.projectLabel}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessagesSquare size={12} />
                        {f.messageCount} message{f.messageCount > 1 ? "s" : ""}
                      </span>
                      {f.exists ? (
                        <span>{formatDate(f.lastModified)}</span>
                      ) : (
                        <span className="text-amber-400">session introuvable</span>
                      )}
                    </div>
                  </div>
                </Link>
                <FavoriteButton favoriteKey={f.key} initial variant="icon" refresh />
              </div>
            ))}
          </div>
        </section>
      )} */}

      {/* Activité : heatmap ou courbe (toggle) + streak dans l'en-tête */}
      <section className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
        <ActivityPanel days={heatDays} streak={a.streak} windowFrom={windowFrom} windowTo={windowTo} />
      </section>

      {/* Distribution horaire des débuts de session */}
      <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
        <HourlyDistribution hours={a.hours} />
      </section>

      {/* Modèles : camembert + tokens/coût */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle>{t("dash.modelBreakdown")}</SectionTitle>
          {a.models.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              {t("dash.noModelData")}
            </p>
          ) : (
            <ModelDonut models={a.models} />
          )}
        </section>

        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle>{t("dash.tokensCostByModel")}</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left eyebrow">
                  <th className="pb-2 font-normal">{t("common.model")}</th>
                  <th className="pb-2 text-right font-normal">
                    <span className="inline-flex items-center justify-end gap-0.5">
                      <ArrowUp
                        size={11}
                        className="text-[var(--color-accent)]"
                      />
                      In
                    </span>
                  </th>
                  <th className="pb-2 text-right font-normal">
                    <span className="inline-flex items-center justify-end gap-0.5">
                      <ArrowDown
                        size={11}
                        className="text-[var(--color-accent)]"
                      />
                      Out
                    </span>
                  </th>
                  <th className="pb-2 text-right font-normal">{t("dash.cache")}</th>
                  <th className="pb-2 text-right font-normal">{t("common.cost")}</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {a.models.map((m) => (
                  <tr
                    key={m.key}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="py-2 font-sans">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: m.color }}
                        />
                        {m.label}
                      </span>
                    </td>
                    <td className="py-2 text-right">{fmt.num(m.tokensIn)}</td>
                    <td className="py-2 text-right">{fmt.num(m.tokensOut)}</td>
                    <td className="py-2 text-right text-[var(--color-muted)]">
                      {fmt.num(m.cacheRead + m.cacheWrite)}
                    </td>
                    <td className="py-2 text-right">{fmt.usd(m.costUSD)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--color-border)] font-medium">
                  <td className="py-2 font-sans">{t("common.total")}</td>
                  <td className="py-2 text-right">{fmt.num(totals.tokensIn)}</td>
                  <td className="py-2 text-right">
                    {fmt.num(totals.tokensOut)}
                  </td>
                  <td className="py-2 text-right text-[var(--color-muted)]">
                    {fmt.num(totals.cacheRead + totals.cacheWrite)}
                  </td>
                  <td className="py-2 text-right">{fmt.usd(totals.costUSD)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Coût par projet */}
      {projectCosts.length > 0 && (
        <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle icon={Coins}>{t("dash.costByProject")}</SectionTitle>
          <ProjectCostList projects={projectCosts} />
        </section>
      )}

      {/* Top outils + stats sessions */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <ToolUsageList tools={a.topTools} />
        </section>

        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
          <SectionTitle icon={Clock}>{t("common.sessions")}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <div className="eyebrow">{t("dash.totalDuration")}</div>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums">
                {fmtDuration(session.totalDurationMs, locale)}
              </div>
            </div>
            <div>
              <div className="eyebrow">{t("dash.avgDuration")}</div>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums">
                {fmtDuration(session.avgDurationMs, locale)}
              </div>
            </div>
            <div>
              <div className="eyebrow">{t("dash.messagesPerSession")}</div>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums">
                {session.avgMessages.toFixed(1)}
              </div>
            </div>
            <div>
              <div className="eyebrow">{t("dash.toolsCalled")}</div>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums">
                {fmt.num(totals.toolUses)}
              </div>
            </div>
            <div>
              <div className="eyebrow">{t("dash.medianDuration")}</div>
              <div className="mt-1 font-mono text-xl font-medium tabular-nums">
                {fmtDuration(session.medianDurationMs, locale)}
              </div>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Brain size={13} className="text-[var(--color-accent)]" />
                {t("dash.thinkingRatio")}
              </span>
              <span className="font-mono tabular-nums">
                {t("dash.thinkingPct", { pct: thinkingPct.toFixed(0) })}
              </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--color-inset)]">
              <div
                className="h-full bg-[var(--color-accent)]"
                style={{ width: `${thinkingPct}%` }}
              />
              <div
                className="h-full bg-[var(--color-faint)]"
                style={{ width: `${100 - thinkingPct}%` }}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Projets récents + Skills */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projets récemment modifiés */}
        <section>
          <SectionTitle
            icon={FolderGit2}
            action={
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
              >
                <FolderGit2 size={14} /> {t("dash.allProjects")}
              </Link>
            }
          >
            {t("dash.recentProjects")}
          </SectionTitle>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] divide-y divide-[var(--color-border)] max-h-[21rem] overflow-y-auto">
            {a.recentProjects.length === 0 && (
              <div className="p-4 text-sm text-[var(--color-muted)]">
                {t("dash.noProjects")}
              </div>
            )}
            {a.recentProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${encodeURIComponent(p.id)}`}
                className="group flex min-h-[4.75rem] items-center gap-3 p-4 hover:bg-[var(--color-hover)] transition-colors"
              >
                <FolderGit2
                  size={15}
                  className="text-[var(--color-accent)] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.label}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-faint)]">
                    <span className="flex items-center gap-1">
                      <MessagesSquare size={12} />
                      {tPlural(t, "dash.session", p.sessionCount)}
                    </span>
                    <span
                      className="flex items-center gap-1"
                      title={t("dash.createdOn", { date: formatDate(p.createdAt, locale) })}
                    >
                      <Clock size={12} />
                      {t("dash.existsFor", { duration: formatDuration(Date.now() - p.createdAt, locale) })}
                    </span>
                    <span
                      className="flex items-center gap-1"
                      title={formatDate(p.lastModified, locale)}
                    >
                      <History size={12} />
                      {t("dash.modified", { relative: formatRelative(p.lastModified, locale) })}
                    </span>
                    {p.costUSD > 0 && (
                      <span className="flex items-center gap-1">
                        <Coins size={12} />
                        {fmt.usd(p.costUSD)}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight
                  size={16}
                  className="text-[var(--color-faint)] group-hover:text-[var(--color-fg)] transition-colors shrink-0"
                />
              </Link>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section>
          <SectionTitle
            icon={Sparkles}
            action={
              <Link
                href="/skills"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
              >
                <Sparkles size={14} /> {t("dash.viewSkills")}
              </Link>
            }
          >
            {t("sidebar.skills")}
          </SectionTitle>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] divide-y divide-[var(--color-border)] max-h-[21rem] overflow-y-auto">
            {recentSkills.length === 0 && (
              <div className="p-4 text-sm text-[var(--color-muted)]">
                {t("dash.noSkills")}
              </div>
            )}
            {recentSkills.map((s) => (
              <Link
                key={s.slug}
                href={`/skills/${encodeURIComponent(s.slug)}`}
                className="group flex min-h-[4.75rem] items-center gap-3 p-4 hover:bg-[var(--color-hover)] transition-colors"
              >
                <Sparkles
                  size={15}
                  className="text-[var(--color-accent)] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  {s.description && (
                    <div className="text-xs text-[var(--color-muted)] truncate">
                      {s.description}
                    </div>
                  )}
                </div>
                <ArrowRight
                  size={16}
                  className="text-[var(--color-faint)] group-hover:text-[var(--color-fg)] transition-colors shrink-0"
                />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
