import Link from "next/link";
import { Sparkles, FolderGit2, MessagesSquare, ArrowRight } from "lucide-react";
import { listSkills } from "@/lib/skills";
import { listProjects } from "@/lib/projects";
import { CLAUDE_DIR } from "@/lib/claude";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [skills, projects] = await Promise.all([listSkills(), listProjects()]);
  const totalSessions = projects.reduce((n, p) => n + p.sessionCount, 0);

  const cards = [
    {
      href: "/skills",
      label: "Skills",
      value: skills.length,
      icon: Sparkles,
      hint: "Voir et éditer",
    },
    {
      href: "/projects",
      label: "Projets",
      value: projects.length,
      icon: FolderGit2,
      hint: "Explorer",
    },
    {
      href: "/projects",
      label: "Sessions",
      value: totalSessions,
      icon: MessagesSquare,
      hint: "Historiques de conversation",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold">Vue d&apos;ensemble</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)] font-mono">{CLAUDE_DIR}</p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ href, label, value, icon: Icon, hint }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-accent)]/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <Icon size={18} className="text-[var(--color-accent)]" />
              <ArrowRight
                size={16}
                className="text-[var(--color-faint)] group-hover:text-[var(--color-fg)] transition-colors"
              />
            </div>
            <div className="mt-4 text-3xl font-semibold tabular-nums">{value}</div>
            <div className="mt-1 text-sm text-[var(--color-fg)]">{label}</div>
            <div className="text-xs text-[var(--color-muted)]">{hint}</div>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-medium text-[var(--color-muted)] mb-3">Skills récents</h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] divide-y divide-[var(--color-border)]">
          {skills.length === 0 && (
            <div className="p-4 text-sm text-[var(--color-muted)]">Aucun skill trouvé.</div>
          )}
          {skills.slice(0, 5).map((s) => (
            <Link
              key={s.slug}
              href={`/skills/${encodeURIComponent(s.slug)}`}
              className="flex items-center gap-3 p-4 hover:bg-[var(--color-hover)] transition-colors"
            >
              <Sparkles size={15} className="text-[var(--color-accent)] shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-[var(--color-muted)] truncate">{s.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
