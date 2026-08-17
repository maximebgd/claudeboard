import { Share2, Sparkles, Bot, SquareSlash } from "lucide-react";
import { getDependencyGraph } from "@/lib/graph";
import DependencyGraph from "@/components/DependencyGraph";
import { getT } from "@/lib/i18n";
import { tPlural } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const [graph, { t }] = await Promise.all([getDependencyGraph(), getT()]);
  const total = graph.nodes.length;

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Share2 size={22} className="text-[var(--color-accent)]" />
        {t("sidebar.graph")}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t("graph.subtitle")}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Sparkles} color="var(--color-accent)" label={t("sidebar.skills")} value={graph.counts.skill} />
        <StatCard icon={Bot} color="#6366f1" label={t("sidebar.agents")} value={graph.counts.agent} />
        <StatCard icon={SquareSlash} color="#10b981" label={t("sidebar.commands")} value={graph.counts.command} />
        <StatCard
          icon={Share2}
          color="var(--color-accent)"
          label={t("common.total")}
          value={total}
          sub={t("graph.sub", {
            links: tPlural(t, "graph.link", graph.edges.length),
            orphans: tPlural(t, "graph.orphan", graph.orphans),
          })}
        />
      </div>

      <div className="mt-6">
        <DependencyGraph nodes={graph.nodes} edges={graph.edges} />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  color: string;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      {/* Tick d'accent (couleur du type) */}
      <span className="absolute left-0 top-0 h-6 w-px" style={{ backgroundColor: color, opacity: 0.5 }} />
      <div className="flex items-center gap-1.5">
        <Icon size={14} color={color} className="shrink-0" />
        <span className="eyebrow whitespace-nowrap tracking-[0.05em]">{label}</span>
      </div>
      <div className="mt-3 font-mono text-[1.7rem] font-medium leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1.5 font-mono text-[11px] text-[var(--color-faint)]">{sub}</div>}
    </div>
  );
}
