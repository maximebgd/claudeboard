import { getSession, listSessions, listProjects, projectLabel } from "@/lib/projects";
import { getProjectStats } from "@/lib/analytics";
import { getT } from "@/lib/i18n";
import {
  sessionToMarkdown,
  sessionToHtml,
  projectToMarkdown,
  projectToHtml,
  exportFilename,
  type ExportFormat,
} from "@/lib/export";

export const dynamic = "force-dynamic";

/**
 * Export **lecture seule** d'une session ou d'un projet complet en Markdown/HTML
 * (partage / archive). GET pour permettre un téléchargement direct via `<a href>`.
 * Aucune écriture : hors du modèle de permissions.
 *
 *   /api/export?scope=session&projectId=…&sessionId=…&format=md|html
 *   /api/export?scope=project&projectId=…&format=md|html
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const projectId = searchParams.get("projectId") ?? "";
  const sessionId = searchParams.get("sessionId") ?? "";
  const format = (searchParams.get("format") ?? "md") as ExportFormat;
  // Stats incluses par défaut ; `stats=0` (ou `none`) exporte le projet sans le
  // bloc de statistiques (KPI, tokens in/out, modèles, top outils).
  const statsParam = searchParams.get("stats");
  const includeStats = statsParam !== "0" && statsParam !== "none";

  if (format !== "md" && format !== "html") {
    return new Response("Invalid format", { status: 400 });
  }
  if (!projectId || projectId.includes("/") || projectId.includes("..")) {
    return new Response("Invalid project", { status: 400 });
  }

  const contentType =
    format === "html" ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8";

  try {
    // Langue de claudeboard (store) : traduit les libellés de l'app dans l'export.
    const i18n = await getT();
    // Chemin réel du projet (best-effort) pour un en-tête lisible.
    const projects = await listProjects();
    const meta = projects.find((p) => p.id === projectId);
    const realPath = meta?.realPath ?? projectId;
    const label = meta ? projectLabel(meta.realPath) : projectId;

    if (scope === "session") {
      if (!sessionId || sessionId.includes("/") || sessionId.includes("..")) {
        return new Response("Invalid session", { status: 400 });
      }
      const session = await getSession(projectId, sessionId);
      if (!session) return new Response("Session not found", { status: 404 });
      const out =
        format === "html"
          ? await sessionToHtml(session, realPath, i18n)
          : sessionToMarkdown(session, realPath, i18n);
      const filename = exportFilename(`${label}-${session.title}`, format);
      return new Response(out, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (scope === "project") {
      const [metas, stats] = await Promise.all([
        listSessions(projectId),
        getProjectStats(projectId),
      ]);
      const sessions = [];
      for (const s of metas) {
        const full = await getSession(projectId, s.id);
        if (full) sessions.push(full);
      }
      if (sessions.length === 0) {
        return new Response("No session to export", { status: 404 });
      }
      const out =
        format === "html"
          ? await projectToHtml(realPath, label, sessions, stats, metas, i18n, includeStats)
          : projectToMarkdown(realPath, label, sessions, stats, metas, i18n, includeStats);
      const filename = exportFilename(label, format);
      return new Response(out, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return new Response("Unknown scope", { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return new Response(msg, { status: 500 });
  }
}
