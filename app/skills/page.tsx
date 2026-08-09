import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { listSkills } from "@/lib/skills";
import { formatDate } from "@/lib/claude";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const skills = await listSkills();
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="eyebrow flex items-center gap-2">
        <Sparkles size={13} className="text-[var(--color-accent)]" />
        <span>{skills.length} skill{skills.length > 1 ? "s" : ""}</span>
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Skills</h1>
      <p className="mt-2 flex items-center gap-2 font-mono text-sm text-[var(--color-muted)]">
        <span className="text-[var(--color-accent)]" aria-hidden>$</span>
        ~/.claude/skills
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {skills.length === 0 && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
            Aucun skill trouvé dans ~/.claude/skills.
          </div>
        )}
        {skills.map((s) => (
          <Link
            key={s.slug}
            href={`/skills/${encodeURIComponent(s.slug)}`}
            className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-accent)]/50 transition-colors flex items-start gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <code className="text-[11px] text-[var(--color-muted)] bg-[var(--color-code)] rounded px-1.5 py-0.5">
                  {s.slug}
                </code>
              </div>
              <p className="mt-1.5 text-sm text-[var(--color-muted)] line-clamp-2">{s.description}</p>
              <p className="mt-2 text-[11px] text-[var(--color-faint)]">
                Modifié le {formatDate(s.updatedAt)}
              </p>
            </div>
            <ChevronRight
              size={18}
              className="text-[var(--color-faint)] group-hover:text-[var(--color-fg)] shrink-0 mt-1"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
