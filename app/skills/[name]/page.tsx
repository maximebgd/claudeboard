import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSkill } from "@/lib/skills";
import { formatDate } from "@/lib/claude";
import SkillEditor from "@/components/SkillEditor";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const slug = decodeURIComponent(name);
  const skill = await getSkill(slug);
  if (!skill) notFound();

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <Link
        href="/skills"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft size={15} /> Skills
      </Link>

      <div className="mt-4 mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{skill.name}</h1>
          <code className="text-xs text-[var(--color-muted)] bg-[var(--color-code)] rounded px-2 py-0.5">
            {skill.slug}
          </code>
        </div>
        {skill.description && (
          <p className="mt-2 text-sm text-[var(--color-muted)]">{skill.description}</p>
        )}
        <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
          {skill.path} · modifié le {formatDate(skill.updatedAt)}
        </p>
      </div>

      <SkillEditor slug={skill.slug} initialRaw={skill.raw} content={skill.content} />
    </div>
  );
}
