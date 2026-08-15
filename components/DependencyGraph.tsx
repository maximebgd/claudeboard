"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Bot, SquareSlash, ArrowRight, ExternalLink } from "lucide-react";

/**
 * Visualisation du graphe de dépendances (skills / agents / commandes).
 *
 * - Les nœuds **connectés** (au moins un lien) sont placés par un layout
 *   force-dirigé (Fruchterman-Reingold) déterministe calculé en `useMemo` — donc
 *   stable entre SSR et client. Ils occupent toute la zone principale.
 * - Les nœuds **isolés** (aucun lien) sont sortis de la simulation et rangés en
 *   grille régulière dans une bande dédiée en bas, pour ne pas encombrer le
 *   graphe ni se chevaucher.
 *
 * Le rendu se fait en passes séparées (liens → cercles → labels) pour que les
 * étiquettes ne soient jamais masquées par un cercle voisin ; le nœud survolé/
 * sélectionné passe au premier plan. Types redéfinis localement pour garder le
 * composant indépendant de `lib/graph` (qui dépend de `fs`).
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

const W = 900;
const MAIN_H = 540; // zone du graphe force-dirigé
const PAD = 72;
const ORPHAN_CELL = 176; // largeur d'une cellule de la grille des isolés
const ORPHAN_ROW_H = 66;

function radiusOf(n: GNode): number {
  return Math.min(20, 9 + n.degree * 1.4);
}

function truncate(s: string, n = 22): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

type Pos = { x: number; y: number };

/** Layout force-dirigé déterministe sur les nœuds connectés. */
function computeLayout(nodes: GNode[], edges: GEdge[]): Map<string, Pos> {
  const N = nodes.length;
  const out = new Map<string, Pos>();
  if (N === 0) return out;
  if (N === 1) {
    out.set(nodes[0].id, { x: W / 2, y: MAIN_H / 2 });
    return out;
  }

  const pos: Pos[] = nodes.map((_, i) => {
    const a = (i / N) * Math.PI * 2;
    // léger décalage déterministe pour casser les symétries parfaites
    return { x: W / 2 + Math.cos(a) * 230 + (i % 4) * 3, y: MAIN_H / 2 + Math.sin(a) * 180 + (i % 3) * 3 };
  });
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const links = edges
    .map((e) => [idx.get(e.from), idx.get(e.to)] as const)
    .filter(([a, b]) => a !== undefined && b !== undefined) as [number, number][];

  const availW = W - 2 * PAD;
  const availH = MAIN_H - 2 * PAD;
  // constante généreuse → longueur d'arête « idéale » plus grande, donc plus d'air
  const k = 1.2 * Math.sqrt((availW * availH) / N);
  const cx = W / 2;
  const cy = MAIN_H / 2;
  let temp = W / 6;

  for (let iter = 0; iter < 600; iter++) {
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
    // gravité douce vers le centre (garde le graphe groupé et centré)
    for (let i = 0; i < N; i++) {
      disp[i].x += (cx - pos[i].x) * 0.01;
      disp[i].y += (cy - pos[i].y) * 0.01;
    }
    // déplacement limité par la température, puis clamp dans le cadre
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(disp[i].x, disp[i].y);
      if (d > 0) {
        pos[i].x += (disp[i].x / d) * Math.min(d, temp);
        pos[i].y += (disp[i].y / d) * Math.min(d, temp);
      }
      pos[i].x = Math.max(PAD, Math.min(W - PAD, pos[i].x));
      pos[i].y = Math.max(PAD, Math.min(MAIN_H - PAD, pos[i].y));
    }
    temp *= 0.95;
  }

  nodes.forEach((n, i) => out.set(n.id, pos[i]));
  return out;
}

export default function DependencyGraph({ nodes, edges }: { nodes: GNode[]; edges: GEdge[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const connected = useMemo(() => nodes.filter((n) => n.degree > 0), [nodes]);
  const orphans = useMemo(() => nodes.filter((n) => n.degree === 0), [nodes]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // positions : force-dirigé pour les connectés, grille pour les isolés
  const { layout, totalH, orphanTop } = useMemo(() => {
    const map = computeLayout(connected, edges);
    let stripH = 0;
    let contentTop = MAIN_H;
    if (orphans.length > 0) {
      const cols = Math.max(1, Math.min(orphans.length, Math.floor((W - 2 * PAD) / ORPHAN_CELL)));
      const rows = Math.ceil(orphans.length / cols);
      contentTop = MAIN_H + 44; // ligne de séparation + titre « Sans lien »
      orphans.forEach((n, i) => {
        const row = Math.floor(i / cols);
        const itemsInRow = row < rows - 1 ? cols : orphans.length - cols * (rows - 1);
        const colInRow = i - row * cols;
        const rowWidth = itemsInRow * ORPHAN_CELL;
        const startX = (W - rowWidth) / 2 + ORPHAN_CELL / 2;
        map.set(n.id, { x: startX + colInRow * ORPHAN_CELL, y: contentTop + row * ORPHAN_ROW_H });
      });
      stripH = 44 + rows * ORPHAN_ROW_H;
    }
    return { layout: map, totalH: MAIN_H + stripH, orphanTop: MAIN_H };
  }, [connected, orphans, edges]);

  const active = hovered ?? selected;

  const neighbors = useMemo(() => {
    if (!active) return new Set<string>();
    const s = new Set<string>();
    for (const e of edges) {
      if (e.from === active) s.add(e.to);
      if (e.to === active) s.add(e.from);
    }
    return s;
  }, [active, edges]);

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
  // nœud actif dessiné en dernier (premier plan)
  const drawOrder = [...nodes].sort(
    (a, b) => (a.id === active ? 1 : 0) - (b.id === active ? 1 : 0),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${totalH}`}
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

          {/* Fond capteur : cliquer dans le vide désélectionne, survoler le vide
              (y compris en venant d'un nœud) réinitialise le survol. Placé en
              premier → derrière tout le reste. */}
          <rect
            x={0}
            y={0}
            width={W}
            height={totalH}
            fill="transparent"
            pointerEvents="all"
            onMouseEnter={() => setHovered(null)}
            onClick={() => setSelected(null)}
          />

          {/* Passe 1 : liens */}
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
            const sx = a.x + ux * (rA + 2);
            const sy = a.y + uy * (rA + 2);
            const ex = b.x - ux * (rB + 6);
            const ey = b.y - uy * (rB + 6);
            // courbure perpendiculaire (signe stable) pour séparer les liens réciproques
            const sign = e.from < e.to ? 1 : -1;
            const mx = (sx + ex) / 2 + -uy * 24 * sign;
            const my = (sy + ey) / 2 + ux * 24 * sign;
            const highlighted = active !== null && (e.from === active || e.to === active);
            const dim = active !== null && !highlighted;
            return (
              <path
                key={i}
                d={`M${sx},${sy} Q${mx},${my} ${ex},${ey}`}
                fill="none"
                stroke={dim ? "var(--color-border)" : highlighted ? TYPE_COLOR[src.type] : "var(--color-faint)"}
                strokeWidth={highlighted ? 1.8 : 1}
                strokeOpacity={dim ? 0.3 : highlighted ? 0.95 : 0.45}
                markerEnd={`url(#${dim ? "arrow-dim" : highlighted ? `arrow-${src.type}` : "arrow-dim"})`}
                pointerEvents="none"
              />
            );
          })}

          {/* Séparateur + titre de la bande des nœuds isolés */}
          {orphans.length > 0 && (
            <g pointerEvents="none">
              <line
                x1={PAD}
                y1={orphanTop + 16}
                x2={W - PAD}
                y2={orphanTop + 16}
                stroke="var(--color-border)"
                strokeDasharray="4 4"
              />
              <text
                x={PAD}
                y={orphanTop + 36}
                fontSize="11"
                fill="var(--color-faint)"
                letterSpacing="0.08em"
              >
                SANS LIEN ({orphans.length})
              </text>
            </g>
          )}

          {/* Passe 2 : cercles */}
          {drawOrder.map((n) => {
            const p = layout.get(n.id);
            if (!p) return null;
            const r = radiusOf(n);
            const dim = isDim(n.id);
            const isActive = n.id === active;
            const isSel = n.id === selected;
            return (
              <circle
                key={n.id}
                cx={p.x}
                cy={p.y}
                r={r}
                fill={TYPE_COLOR[n.type]}
                fillOpacity={dim ? 0.3 : isActive ? 1 : 0.85}
                stroke={isSel ? "var(--color-fg)" : "var(--color-panel)"}
                strokeWidth={isSel ? 2.5 : 2}
                className="cursor-pointer"
                style={{ transition: "fill-opacity 120ms" }}
                onMouseEnter={() => setHovered(n.id)}
                onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
              />
            );
          })}

          {/* Passe 3 : labels (toujours au-dessus des cercles) */}
          {drawOrder.map((n) => {
            const p = layout.get(n.id);
            if (!p) return null;
            const r = radiusOf(n);
            const dim = isDim(n.id);
            const isActive = n.id === active;
            const label = truncate(n.name);
            const plateW = label.length * 6.3 + 10;
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                className="cursor-pointer"
                style={{ opacity: dim ? 0.35 : 1, transition: "opacity 120ms" }}
                onMouseEnter={() => setHovered(n.id)}
                onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
              >
                <rect
                  x={-plateW / 2}
                  y={r + 3}
                  width={plateW}
                  height={16}
                  rx={4}
                  fill="var(--color-panel)"
                  opacity={isActive ? 0.95 : 0.72}
                />
                <text
                  y={r + 14}
                  textAnchor="middle"
                  fontSize="11"
                  fill={isActive ? "var(--color-fg)" : "var(--color-muted)"}
                  fontWeight={isActive ? 600 : 400}
                >
                  {label}
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
