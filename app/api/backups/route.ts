import { NextResponse } from "next/server";
import {
  isConfigTarget,
  configResource,
  readConfigFile,
  writeConfigFile,
  type ConfigTarget,
} from "@/lib/configFiles";
import { getSkill, writeSkill, isValidSkillSlug } from "@/lib/skills";
import { getMdEntry, writeMdEntry, isMdKind, isValidMdSlug } from "@/lib/mdEntries";
import { listBackups, readBackup, deleteBackup, MAX_VERSIONS } from "@/lib/backups";
import { isAllowed, type PermissionResource } from "@/lib/store";

/**
 * Historique de versions du contenu éditable de ~/.claude : les fichiers de config
 * uniques (settings, CLAUDE.md, keybindings) **et** les entrées à frontmatter (skills,
 * agents, commandes). Les versions sont archivées automatiquement à chaque enregistrement
 * (cf. `lib/backups.ts`), **hors** de ~/.claude. Lecture (liste + aperçu) libre ; la
 * restauration réécrit le fichier (via l'écrivain de la ressource, qui archive d'abord la
 * version courante) et la suppression d'une version élaguent l'historique : les deux sont
 * verrouillées par la permission `modify` de la ressource cible.
 *
 * La `target` est soit une cible de config (`settings`, `claudeMd`, …), soit un chemin
 * d'entrée : `skills/<slug>`, `agents/<slug>`, `commands/<ns>/<slug>`.
 */

interface Resolved {
  /** Ressource de permission gouvernant restore/delete de cette cible. */
  resource: PermissionResource;
  /** Contenu actuel du fichier ("" s'il n'existe pas) — base du diff et du marquage « Actuelle ». */
  readCurrent: () => Promise<string>;
  /** Réécrit le fichier avec `content` (archive d'abord la version courante). */
  restore: (content: string) => Promise<unknown>;
}

/**
 * Résout une `target` d'archivage en { ressource, lecteur courant, écrivain }, ou `null`
 * si la cible est inconnue/invalide. Valide les slugs (double sécurité avec `safeResolve`
 * côté écrivains et la garde anti-traversée de `backups.ts`).
 */
function resolve(target: string): Resolved | null {
  if (isConfigTarget(target)) {
    const t: ConfigTarget = target;
    return {
      resource: configResource(t),
      readCurrent: async () => (await readConfigFile(t)).raw,
      restore: (content) => writeConfigFile(t, content),
    };
  }
  const parts = target.split("/");
  const [head, ...rest] = parts;
  const slug = rest.join("/");
  if (head === "skills") {
    // Les skills n'ont pas de namespace : slug = un seul segment.
    if (rest.length !== 1 || !isValidSkillSlug(slug)) return null;
    return {
      resource: "skills",
      readCurrent: async () => (await getSkill(slug))?.raw ?? "",
      restore: (content) => writeSkill(slug, content),
    };
  }
  if (isMdKind(head)) {
    // agents (plat) / commandes (namespaces imbriqués autorisés).
    if (rest.length === 0 || !isValidMdSlug(slug)) return null;
    const kind = head;
    return {
      resource: kind,
      readCurrent: async () => (await getMdEntry(kind, slug))?.raw ?? "",
      restore: (content) => writeMdEntry(kind, slug, content),
    };
  }
  return null;
}

/** GET ?target=…            → { versions } (liste, récentes d'abord). */
/** GET ?target=…&id=…       → { content } (contenu d'une version, pour aperçu/diff). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("target") ?? "";
  const id = url.searchParams.get("id");
  const r = resolve(target);
  if (!r) {
    return NextResponse.json({ error: "Unknown target" }, { status: 400 });
  }
  if (id) {
    try {
      const content = await readBackup(target, id);
      return NextResponse.json({ content });
    } catch {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
  }
  const current = await r.readCurrent();
  const versions = await listBackups(target, current);
  return NextResponse.json({ versions, maxVersions: MAX_VERSIONS });
}

/** POST { op: "restore", target, id } → réécrit le fichier avec la version choisie. */
/** POST { op: "delete",  target, id } → supprime définitivement une version. */
export async function POST(req: Request) {
  let body: { op?: unknown; target?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { op, target, id } = body;
  if (op !== "restore" && op !== "delete") {
    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  }
  if (typeof target !== "string" || typeof id !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const r = resolve(target);
  if (!r) {
    return NextResponse.json({ error: "Unknown target" }, { status: 400 });
  }

  // Restaurer réécrit le fichier ; supprimer élague l'historique de la cible : les
  // deux passent par la permission `modify` de la ressource cible.
  if (!(await isAllowed(r.resource, "modify"))) {
    return NextResponse.json(
      { error: "Not allowed — enable it in Preferences." },
      { status: 403 }
    );
  }

  try {
    if (op === "delete") {
      await deleteBackup(target, id);
      return NextResponse.json({ ok: true });
    }
    const content = await readBackup(target, id);
    const backupPath = await r.restore(content);
    return NextResponse.json({ ok: true, backupPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Operation failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
