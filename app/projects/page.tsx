import Link from "next/link";
import { FolderGit2, ChevronRight, MessagesSquare } from "lucide-react";
import { listProjects, projectLabel } from "@/lib/projects";
import { formatDate } from "@/lib/claude";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FolderGit2 size={22} className="text-[var(--color-accent)]" />
          Projets & Sessions
        </h1>
        <ReadOnlyBadge />
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {projects.length} projet{projects.length > 1 ? "s" : ""} avec historique de session
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {projects.length === 0 && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
            Aucun projet trouvé dans ~/.claude/projects.
          </div>
        )}
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${encodeURIComponent(p.id)}`}
            className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-accent)]/50 transition-colors flex items-center gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">{projectLabel(p.realPath)}</div>
              <div className="mt-0.5 text-xs text-[var(--color-muted)] font-mono truncate">
                {p.realPath}
              </div>
              <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--color-faint)]">
                <span className="flex items-center gap-1">
                  <MessagesSquare size={12} />
                  {p.sessionCount} session{p.sessionCount > 1 ? "s" : ""}
                </span>
                <span>Activité : {formatDate(p.lastModified)}</span>
              </div>
            </div>
            <ChevronRight
              size={18}
              className="text-[var(--color-faint)] group-hover:text-[var(--color-fg)] shrink-0"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
