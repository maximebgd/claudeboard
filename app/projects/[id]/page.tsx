import Link from "next/link";
import { ArrowLeft, MessagesSquare, ChevronRight } from "lucide-react";
import { listSessions, listProjects, projectLabel } from "@/lib/projects";
import { formatDate, formatSize } from "@/lib/claude";

export const dynamic = "force-dynamic";

export default async function ProjectSessionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const [sessions, projects] = await Promise.all([listSessions(id), listProjects()]);
  const project = projects.find((p) => p.id === id);

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft size={15} /> Projets
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">
          {project ? projectLabel(project.realPath) : id}
        </h1>
        {project && (
          <p className="mt-1 text-xs text-[var(--color-muted)] font-mono">{project.realPath}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {sessions.length === 0 && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
            Aucune session.
          </div>
        )}
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/projects/${encodeURIComponent(id)}/${encodeURIComponent(s.id)}`}
            className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-accent)]/50 transition-colors flex items-center gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{s.title}</div>
              <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--color-faint)]">
                <span className="flex items-center gap-1">
                  <MessagesSquare size={12} />
                  {s.messageCount} messages
                </span>
                <span>{formatDate(s.lastModified)}</span>
                <span>{formatSize(s.size)}</span>
                <code className="text-[var(--color-faint)]">{s.id.slice(0, 8)}</code>
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
