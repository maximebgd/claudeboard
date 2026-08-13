import Link from "next/link";
import { FolderGit2, ChevronRight, MessagesSquare, Coins, Clock, History } from "lucide-react";
import { listProjects, projectLabel } from "@/lib/projects";
import { getAnalytics } from "@/lib/analytics";
import { formatDate, formatDuration, formatRelative } from "@/lib/claude";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";
import FavoriteButton from "@/components/FavoriteButton";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

function fmtUSD(n: number): string {
  if (n > 0 && n < 0.01) return "< 0,01 $";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export default async function ProjectsPage() {
  const [projects, analytics, store] = await Promise.all([
    listProjects(),
    getAnalytics(),
    readStore(),
  ]);
  const costById = new Map(analytics.projectCosts.map((p) => [p.id, p.costUSD]));
  const favSet = new Set(store.favoriteProjects);
  // Projets épinglés toujours en tête ; à l'intérieur de chaque groupe, tri par
  // dernière modification (récent → ancien). `listProjects` renvoie déjà trié
  // par `lastModified` desc, on ne fait que remonter le groupe épinglé.
  const sortedProjects = [...projects].sort((a, b) => {
    const fa = favSet.has(a.id);
    const fb = favSet.has(b.id);
    if (fa !== fb) return fa ? -1 : 1;
    return b.lastModified - a.lastModified;
  });
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
        {sortedProjects.map((p) => (
          <div
            key={p.id}
            className={`group rounded-xl border bg-[var(--color-panel)] p-5 hover:border-[var(--color-accent)]/50 transition-colors flex items-center gap-4 ${
              favSet.has(p.id) ? "border-[var(--color-accent)]/40" : "border-[var(--color-border)]"
            }`}
          >
            <Link href={`/projects/${encodeURIComponent(p.id)}`} className="min-w-0 flex-1">
              <div className="font-medium">{projectLabel(p.realPath)}</div>
              <div className="mt-0.5 text-xs text-[var(--color-muted)] font-mono truncate">
                {p.realPath}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-faint)]">
                <span className="flex items-center gap-1">
                  <MessagesSquare size={12} />
                  {p.sessionCount} session{p.sessionCount > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1" title={`Créé le ${formatDate(p.createdAt)}`}>
                  <Clock size={12} />
                  Existe depuis {formatDuration(Date.now() - p.createdAt)}
                </span>
                <span className="flex items-center gap-1" title={formatDate(p.lastModified)}>
                  <History size={12} />
                  Modifié {formatRelative(p.lastModified)}
                </span>
                {(costById.get(p.id) ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Coins size={12} />
                    {fmtUSD(costById.get(p.id) ?? 0)}
                  </span>
                )}
              </div>
            </Link>
            <FavoriteButton
              favoriteKey={p.id}
              initial={favSet.has(p.id)}
              variant="icon"
              section="projects"
            />
            <Link
              href={`/projects/${encodeURIComponent(p.id)}`}
              aria-label="Ouvrir le projet"
              className="shrink-0"
            >
              <ChevronRight
                size={18}
                className="text-[var(--color-faint)] group-hover:text-[var(--color-fg)]"
              />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
