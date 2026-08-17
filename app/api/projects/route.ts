import { NextResponse } from "next/server";
import { deleteProject, deleteSession } from "@/lib/projects";
import { isAllowed } from "@/lib/store";

/**
 * Supprime un projet entier ou une seule session (déplacement en corbeille,
 * réversible). Verrouillé par la permission projects.delete. Les identifiants sont
 * refusés s'ils tentent une traversée (double sécurité avec safeResolve).
 */
export async function POST(req: Request) {
  let body: { op?: unknown; scope?: unknown; projectId?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { op, scope, projectId, sessionId } = body;
  if (op !== "delete") {
    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  }
  if (typeof projectId !== "string" || !projectId || projectId.includes("/") || projectId.includes("..")) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  if (!(await isAllowed("projects", "delete"))) {
    return NextResponse.json(
      { error: "Deleting is not allowed — enable it in Preferences." },
      { status: 403 }
    );
  }

  try {
    if (scope === "session") {
      if (
        typeof sessionId !== "string" ||
        !sessionId ||
        sessionId.includes("/") ||
        sessionId.includes("..")
      ) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
      const trashPath = await deleteSession(projectId, sessionId);
      return NextResponse.json({ ok: true, trashPath });
    }
    if (scope === "project") {
      const trashPath = await deleteProject(projectId);
      return NextResponse.json({ ok: true, trashPath });
    }
    return NextResponse.json({ error: "Unknown scope" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
