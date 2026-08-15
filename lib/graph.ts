import { listSkills, getSkill } from "./skills";
import { listMdEntries, getMdEntry } from "./mdEntries";

/**
 * Graphe de dépendances entre les entrées de configuration de ~/.claude :
 * skills, agents et commandes. Un « lien » est une **référence textuelle** :
 * une entrée qui nomme une autre dans son corps (appel de slash-command `/x`,
 * mention d'un agent `@x`, nom d'un skill en backticks ou cité tel quel).
 *
 * La détection est volontairement conservatrice pour éviter le bruit : les
 * formes explicites (`/slash`, `@agent`, `` `code` ``) créent toujours un lien ;
 * une simple mention en prose ne compte que si l'identifiant est distinctif
 * (avec tiret, namespace, ou ≥ 7 caractères), pour ne pas transformer un mot
 * courant (« commit », « merge ») en fausse dépendance.
 */

export type NodeType = "skill" | "agent" | "command";

/** Forme sous laquelle une référence apparaît dans le texte source. */
export type RefForm = "slash" | "at" | "code" | "mention";

export interface GraphNode {
  id: string; // `${type}:${slug}` — identifiant unique dans le graphe
  type: NodeType;
  slug: string;
  name: string;
  description: string;
  href: string; // page correspondante dans l'app
  updatedAt: number;
  degree: number; // nb de liens incidents (in + out), rempli en fin de build
}

export interface GraphEdge {
  from: string; // id du nœud source
  to: string; // id du nœud cible
  forms: RefForm[]; // formes de référence détectées (dédupliquées)
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  counts: Record<NodeType, number>;
  orphans: number; // nœuds sans aucun lien
}

interface Source {
  node: GraphNode;
  text: string; // corps + description, en une seule chaîne à scanner
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Identifiants distinctifs d'un nœud cible (ce par quoi on peut le nommer). */
function identifiers(node: GraphNode): string[] {
  const last = node.slug.split("/").pop() || node.slug;
  const ids = new Set<string>([node.name, node.slug, last]);
  if (node.type === "command") {
    // invocation namespacée : `git/commit` → `git:commit`
    ids.add(node.slug.replace(/\//g, ":"));
  }
  return [...ids].filter((id) => id && id.length >= 3);
}

/** Détecte les formes sous lesquelles `text` référence le nœud `target`. */
function detectForms(text: string, target: GraphNode): RefForm[] {
  const forms = new Set<RefForm>();
  for (const id of identifiers(target)) {
    const e = escapeRegExp(id);
    // Dans un span de code inline `...id...` (id en mot entier, sinon
    // `code-reviewer` matcherait la commande `review`)
    if (new RegExp("`[^`\\n]*(?<![\\w-])" + e + "(?![\\w-])[^`\\n]*`", "i").test(text)) forms.add("code");
    // Slash-command : /id (namespace `:` accepté dans l'id)
    if (target.type === "command" && new RegExp("(?<![\\w-])/" + e + "(?![\\w-])", "i").test(text)) {
      forms.add("slash");
    }
    // Agent : @id
    if (target.type === "agent" && new RegExp("(?<![\\w-])@" + e + "(?![\\w-])", "i").test(text)) {
      forms.add("at");
    }
    // Mention en clair : seulement si l'identifiant est distinctif (peu de risque
    // de collision avec un mot courant). `/` et `@` exclus (déjà couverts ci-dessus).
    const distinctive = id.includes("-") || id.includes(":") || id.includes("/") || id.length >= 7;
    if (distinctive && new RegExp("(?<![\\w@/:-])" + e + "(?![\\w-])", "i").test(text)) {
      forms.add("mention");
    }
  }
  return [...forms];
}

function hrefFor(type: NodeType, slug: string): string {
  const enc = slug.split("/").map(encodeURIComponent).join("/");
  if (type === "skill") return `/skills/${enc}`;
  if (type === "agent") return `/config/agents/${enc}`;
  return `/config/commands/${enc}`;
}

/**
 * Construit le graphe de dépendances complet en un passage : charge le contenu
 * de chaque skill/agent/commande, puis croise chaque source avec toutes les
 * autres cibles pour en déduire les liens.
 */
export async function getDependencyGraph(): Promise<DependencyGraph> {
  const [skillMetas, agentMetas, cmdMetas] = await Promise.all([
    listSkills(),
    listMdEntries("agents"),
    listMdEntries("commands"),
  ]);

  const sources: Source[] = [];

  const skills = await Promise.all(skillMetas.map((m) => getSkill(m.slug)));
  for (const s of skills) {
    if (!s) continue;
    const node: GraphNode = {
      id: `skill:${s.slug}`,
      type: "skill",
      slug: s.slug,
      name: s.name,
      description: s.description,
      href: hrefFor("skill", s.slug),
      updatedAt: s.updatedAt,
      degree: 0,
    };
    sources.push({ node, text: `${s.description}\n${s.content}` });
  }

  for (const [kind, metas] of [
    ["agents", agentMetas],
    ["commands", cmdMetas],
  ] as const) {
    const entries = await Promise.all(metas.map((m) => getMdEntry(kind, m.slug)));
    for (const e of entries) {
      if (!e) continue;
      const type: NodeType = kind === "agents" ? "agent" : "command";
      const node: GraphNode = {
        id: `${type}:${e.slug}`,
        type,
        slug: e.slug,
        name: e.name,
        description: e.description,
        href: hrefFor(type, e.slug),
        updatedAt: e.updatedAt,
        degree: 0,
      };
      sources.push({ node, text: `${e.description}\n${e.content}` });
    }
  }

  const nodes = sources.map((s) => s.node);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: GraphEdge[] = [];

  for (const src of sources) {
    for (const target of nodes) {
      if (target.id === src.node.id) continue;
      const forms = detectForms(src.text, target);
      if (forms.length === 0) continue;
      edges.push({ from: src.node.id, to: target.id, forms });
      src.node.degree++;
      const t = byId.get(target.id);
      if (t) t.degree++;
    }
  }

  const counts: Record<NodeType, number> = { skill: 0, agent: 0, command: 0 };
  for (const n of nodes) counts[n.type]++;

  return {
    nodes,
    edges,
    counts,
    orphans: nodes.filter((n) => n.degree === 0).length,
  };
}
