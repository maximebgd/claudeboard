import { Share2 } from "lucide-react";
import { getDependencyGraph } from "@/lib/graph";
import DependencyGraph from "@/components/DependencyGraph";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const graph = await getDependencyGraph();
  const total = graph.nodes.length;

  const kpis = [
    { label: "Entrées", value: total },
    { label: "Skills", value: graph.counts.skill },
    { label: "Agents", value: graph.counts.agent },
    { label: "Commandes", value: graph.counts.command },
    { label: "Liens", value: graph.edges.length },
    { label: "Isolées", value: graph.orphans },
  ];

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

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3"
          >
            <div className="font-mono text-2xl font-medium tabular-nums">{k.value}</div>
            <div className="eyebrow mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <DependencyGraph nodes={graph.nodes} edges={graph.edges} />
      </div>
    </div>
  );
}
