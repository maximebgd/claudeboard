import { Share2, Sparkles, Bot, SquareSlash } from "lucide-react";
import { getDependencyGraph } from "@/lib/graph";
import DependencyGraph from "@/components/DependencyGraph";

export const dynamic = "force-dynamic";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export default async function GraphPage() {
  const graph = await getDependencyGraph();
  const total = graph.nodes.length;

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Share2 size={22} className="text-[var(--color-accent)]" />
        Graphe de dépendances
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Qui référence qui, entre vos skills, agents et commandes de ~/.claude. Une référence
        est détectée quand une entrée en nomme une autre (appel <code>/commande</code>, mention{" "}
        <code>@agent</code>, nom d&apos;un skill cité).
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Sparkles} color="var(--color-accent)" label="Skills" value={graph.counts.skill} />
        <StatCard icon={Bot} color="#6366f1" label="Agents" value={graph.counts.agent} />
        <StatCard icon={SquareSlash} color="#10b981" label="Commandes" value={graph.counts.command} />
        <StatCard
          icon={Share2}
          color="var(--color-accent)"
          label="Total"
          value={total}
          sub={`dont ${plural(graph.edges.length, "lien")} et ${plural(graph.orphans, "isolé")}`}
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
