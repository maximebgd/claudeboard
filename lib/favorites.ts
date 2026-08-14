import { readStore } from "./store";
import { listProjects, listSessions, projectLabel } from "./projects";

/**
 * Résolution des sessions épinglées. Une clé de favori identifie une session par
 * « <projectId>/<sessionId> » : `projectId` est un nom de dossier (jamais de `/`)
 * et `sessionId` un UUID, donc le premier `/` sépare sans ambiguïté les deux.
 */

export function favoriteKey(projectId: string, sessionId: string): string {
  return `${projectId}/${sessionId}`;
}

export function parseFavoriteKey(key: string): { projectId: string; sessionId: string } | null {
  const idx = key.indexOf("/");
  if (idx <= 0 || idx === key.length - 1) return null;
  return { projectId: key.slice(0, idx), sessionId: key.slice(idx + 1) };
}

export interface FavoriteSession {
  key: string;
  projectId: string;
  sessionId: string;
  title: string;
  projectLabel: string;
  lastModified: number;
  messageCount: number;
  /** false si la session n'existe plus sur le disque (favori orphelin). */
  exists: boolean;
}

/**
 * Résout les favoris en métadonnées de session. Regroupe par projet pour ne
 * scanner `listSessions` qu'une fois par projet. Trié du plus récent au plus ancien.
 */
export async function getFavoriteSessions(): Promise<FavoriteSession[]> {
  const { favorites } = await readStore();
  if (favorites.length === 0) return [];

  const projects = await listProjects();
  const labelById = new Map(projects.map((p) => [p.id, projectLabel(p.realPath)]));

  const byProject = new Map<string, string[]>();
  for (const key of favorites) {
    const parsed = parseFavoriteKey(key);
    if (!parsed) continue;
    const arr = byProject.get(parsed.projectId) ?? [];
    arr.push(parsed.sessionId);
    byProject.set(parsed.projectId, arr);
  }

  const out: FavoriteSession[] = [];
  for (const [projectId, sessionIds] of byProject) {
    const sessions = await listSessions(projectId); // [] si le projet a disparu
    const byId = new Map(sessions.map((s) => [s.id, s]));
    for (const sessionId of sessionIds) {
      const s = byId.get(sessionId);
      out.push({
        key: favoriteKey(projectId, sessionId),
        projectId,
        sessionId,
        title: s?.title ?? "(session introuvable)",
        projectLabel: labelById.get(projectId) ?? projectId,
        lastModified: s?.lastModified ?? 0,
        messageCount: s?.messageCount ?? 0,
        exists: !!s,
      });
    }
  }
  return out.sort((a, b) => b.lastModified - a.lastModified);
}
