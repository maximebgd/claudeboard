"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Bot, SquareSlash, ArrowRight, ExternalLink } from "lucide-react";

/**
 * Visualisation du graphe de dépendances (skills / agents / commandes) : layout
 * force-dirigé (Fruchterman-Reingold) calculé une fois en `useMemo` — le résultat
 * est déterministe (positions initiales sur un cercle, pas d'aléatoire) donc
 * stable entre SSR et client. Survol/clic d'un nœud met en évidence ses voisins ;
 * un panneau latéral liste les références entrantes/sortantes du nœud sélectionné.
 *
 * Types redéfinis localement pour garder le composant indépendant de `lib/graph`
 * (qui dépend de `fs`).
 */

type NodeType = "skill" | "agent" | "command";
type RefForm = "slash" | "at" | "code" | "mention";

interface GNode {
  id: string;
  type: NodeType;
  slug: string;
  name: string;
  description: string;
  href: string;
  degree: number;
}
interface GEdge {
  from: string;
  to: string;
  forms: RefForm[];
}

const TYPE_COLOR: Record<NodeType, string> = {
  skill: "var(--color-accent)",
  agent: "#6366f1",
  command: "#10b981",
};
const TYPE_LABEL: Record<NodeType, string> = {
  skill: "Skill",
  agent: "Agent",
  command: "Commande",
};
const TYPE_ICON: Record<NodeType, typeof Sparkles> = {
  skill: Sparkles,
  agent: Bot,
  command: SquareSlash,
};
const FORM_LABEL: Record<RefForm, string> = {
  slash: "/slash",
  at: "@agent",
  code: "`code`",
  mention: "mention",
};

const W = 820;
const H = 560;
const PAD = 60;

function radiusOf(n: GNode): number {
  return Math.min(22, 9 + n.degree * 1.6);
}

/** Layout force-dirigé déterministe. Renvoie une position {x,y} par id de nœud. */
function computeLayout(nodes: GNode[], edges: GEdge[]): Map<string, { x: number; y: number }> {
  const N = nodes.length;
  const pos = nodes.map((_, i) => {
    const a = (i / Math.max(1, N)) * Math.PI * 2;
    // léger décalage déterministe pour casser les symétries parfaites
    return { x: W / 2 + Math.cos(a) * 200 + (i % 4) * 3, y: H / 2 + Math.sin(a) * 160 + (i % 3) * 3 };
  });
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const links = edges
    .map((e) => [idx.get(e.from), idx.get(e.to)] as const)
    .filter(([a, b]) => a !== undefined && b !== undefined) as [number, number][];

  const area = (W - 2 * PAD) * (H - 2 * PAD);
  const k = 0.75 * Math.sqrt(area / Math.max(1, N));
  const cx = W / 2;
  const cy = H / 2;
  let temp = W / 8;

  for (let iter = 0; iter < 500; iter++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    // répulsion (toutes paires)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) {
          dx = (i - j) * 0.01 + 0.01;
          dy = 0.01;
          d = Math.hypot(dx, dy);
        }
        const f = (k * k) / d;
        const ux = dx / d;
        const uy = dy / d;
        disp[i].x += ux * f;
        disp[i].y += uy * f;
        disp[j].x -= ux * f;
        disp[j].y -= uy * f;
      }
    }
    // attraction (le long des liens)
    for (const [a, b] of links) {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k;
      const ux = dx / d;
      const uy = dy / d;
      disp[a].x -= ux * f;
      disp[a].y -= uy * f;
      disp[b].x += ux * f;
      disp[b].y += uy * f;
    }
    // gravité douce vers le centre (garde les composantes disjointes groupées)
    for (let i = 0; i < N; i++) {
      disp[i].x += (cx - pos[i].x) * 0.012;
      disp[i].y += (cy - pos[i].y) * 0.012;
    }
    // déplacement limité par la température, puis clamp dans le cadre
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(disp[i].x, disp[i].y);
      if (d > 0) {
        pos[i].x += (disp[i].x / d) * Math.min(d, temp);
        pos[i].y += (disp[i].y / d) * Math.min(d, temp);
      }
      pos[i].x = Math.max(PAD, Math.min(W - PAD, pos[i].x));
      pos[i].y = Math.max(PAD, Math.min(H - PAD, pos[i].y));
    }
    temp *= 0.955;
  }

  return new Map(nodes.map((n, i) => [n.id, pos[i]]));
}

export default function DependencyGraph({ nodes, edges }: { nodes: GNode[]; edges: GEdge[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const layout = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const active = hovered ?? selected;

  // voisins directs du nœud actif (pour la mise en évidence)
  const neighbors = useMemo(() => {
    if (!active) return new Set<string>();
    const s = new Set<string>();
    for (const e of edges) {
      if (e.from === active) s.add(e.to);
      if (e.to === active) s.add(e.from);
    }
    return s;
  }, [active, edges]);

  // références du nœud sélectionné (panneau latéral)
  const detail = useMemo(() => {
    if (!selected) return null;
    const node = nodeById.get(selected);
    if (!node) return null;
    const out = edges
      .filter((e) => e.from === selected)
      .map((e) => ({ node: nodeById.get(e.to)!, forms: e.forms }))
      .filter((x) => x.node);
    const inc = edges
      .filter((e) => e.to === selected)
      .map((e) => ({ node: nodeById.get(e.from)!, forms: e.forms }))
      .filter((x) => x.node);
    return { node, out, inc };
  }, [selected, edges, nodeById]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
        Aucun skill, agent ou commande à représenter.
      </div>
    );
  }

  const isDim = (id: string) => active !== null && id !== active && !neighbors.has(id);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            {(["skill", "agent", "command"] as NodeType[]).map((t) => (
              <marker
                key={t}
                id={`arrow-${t}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={TYPE_COLOR[t]} />
              </marker>
            ))}
            <marker
              id="arrow-dim"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--color-faint)" />
            </marker>
          </defs>

          {/* Liens */}
          {edges.map((e, i) => {
            const a = layout.get(e.from);
            const b = layout.get(e.to);
            const src = nodeById.get(e.from);
            if (!a || !b || !src) return null;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 1;
            const ux = dx / d;
            const uy = dy / d;
            const rB = radiusOf(nodeById.get(e.to)!);
            const rA = radiusOf(src);
            // point de départ/arrivée décalés du rayon des nœuds
            const sx = a.x + ux * (rA + 2);
            const sy = a.y + uy * (rA + 2);
            const ex = b.x - ux * (rB + 6);
            const ey = b.y - uy * (rB + 6);
            // courbure perpendiculaire (signe stable) pour séparer les liens réciproques
            const sign = e.from < e.to ? 1 : -1;
            const mx = (sx + ex) / 2 + -uy * 22 * sign;
            const my = (sy + ey) / 2 + ux * 22 * sign;
            const highlighted = active !== null && (e.from === active || e.to === active);
            const dim = active !== null && !highlighted;
            return (
              <path
                key={i}
                d={`M${sx},${sy} Q${mx},${my} ${ex},${ey}`}
                fill="none"
                stroke={dim ? "var(--color-border)" : highlighted ? TYPE_COLOR[src.type] : "var(--color-faint)"}
                strokeWidth={highlighted ? 1.8 : 1}
                strokeOpacity={dim ? 0.35 : highlighted ? 0.9 : 0.5}
                markerEnd={`url(#${dim ? "arrow-dim" : highlighted ? `arrow-${src.type}` : "arrow-dim"})`}
              />
            );
          })}

          {/* Nœuds */}
          {nodes.map((n) => {
            const p = layout.get(n.id);
            if (!p) return null;
            const r = radiusOf(n);
            const dim = isDim(n.id);
            const isActive = n.id === active;
            const isSel = n.id === selected;
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                className="cursor-pointer"
                style={{ opacity: dim ? 0.28 : 1, transition: "opacity 120ms" }}
                onMouseEnter={() => setHovered(n.id)}
                onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
              >
                <circle
                  r={r}
                  fill={TYPE_COLOR[n.type]}
                  fillOpacity={isActive ? 1 : 0.85}
                  stroke={isSel ? "var(--color-fg)" : "var(--color-panel)"}
                  strokeWidth={isSel ? 2.5 : 2}
                />
                <text
                  y={r + 13}
                  textAnchor="middle"
                  fontSize="11"
                  fill={isActive ? "var(--color-fg)" : "var(--color-muted)"}
                  fontWeight={isActive ? 600 : 400}
                >
                  {n.name.length > 20 ? n.name.slice(0, 19) + "…" : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Panneau : légende + détail du nœud sélectionné */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
          <div className="eyebrow mb-3">Légende</div>
          <div className="flex flex-col gap-2">
            {(["skill", "agent", "command"] as NodeType[]).map((t) => {
              const Icon = TYPE_ICON[t];
              const count = nodes.filter((n) => n.type === t).length;
              return (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[t] }} />
                  <Icon size={13} className="text-[var(--color-muted)]" />
                  <span>{TYPE_LABEL[t]}</span>
                  <span className="ml-auto font-mono text-[var(--color-faint)] tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-faint)]">
            La flèche va de l&apos;entrée qui <strong>cite</strong> vers l&apos;entrée <strong>citée</strong>.
            Survolez un nœud pour isoler ses liens, cliquez pour le détailler.
          </p>
        </div>

        {detail ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
            <div className="flex items-start gap-2">
              <span className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[detail.node.type] }} />
              <div className="min-w-0">
                <div className="font-medium truncate">{detail.node.name}</div>
                <code className="text-[11px] text-[var(--color-muted)]">
                  {TYPE_LABEL[detail.node.type]} · {detail.node.slug}
                </code>
              </div>
            </div>

            <RefList title="Référence" items={detail.out} empty="Ne cite aucune autre entrée." onPick={setSelected} />
            <RefList title="Cité par" items={detail.inc} empty="N'est cité par aucune entrée." onPick={setSelected} />

            <Link
              href={detail.node.href}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
            >
              <ExternalLink size={13} /> Ouvrir la page
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">
            Cliquez sur un nœud pour voir ses références entrantes et sortantes.
          </div>
        )}
      </div>
    </div>
  );
}

function RefList({
  title,
  items,
  empty,
  onPick,
}: {
  title: string;
  items: { node: GNode; forms: RefForm[] }[];
  empty: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="mt-3">
      <div className="eyebrow mb-1.5 flex items-center gap-1.5">
        <ArrowRight size={11} /> {title}
        <span className="font-mono text-[var(--color-faint)]">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-[var(--color-faint)]">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map(({ node, forms }) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onPick(node.id)}
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-left text-sm hover:bg-[var(--color-hover)]"
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[node.type] }} />
                <span className="truncate">{node.name}</span>
                <span className="ml-auto flex shrink-0 gap-1">
                  {forms.map((f) => (
                    <code key={f} className="rounded bg-[var(--color-code)] px-1 text-[10px] text-[var(--color-muted)]">
                      {FORM_LABEL[f]}
                    </code>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
