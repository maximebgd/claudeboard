import { FolderTree } from "lucide-react";
import DirectoryExplorer from "@/components/DirectoryExplorer";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Structure du dossier · Claudeboard",
};

export default async function DirectoryPage() {
  const { t } = await getT();
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <FolderTree size={22} className="text-[var(--color-accent)]" />
        {t("docsNav.structure")}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {t("structure.subtitleA")}{" "}
        <code className="rounded bg-[var(--color-code)] px-1.5 py-0.5 font-mono text-[var(--color-fg)]">
          .claude/
        </code>{" "}
        {t("structure.subtitleB")}{" "}
        <code className="rounded bg-[var(--color-code)] px-1.5 py-0.5 font-mono text-[var(--color-fg)]">
          ~/.claude
        </code>{" "}
        {t("structure.subtitleC")}
      </p>

      <div className="mt-6">
        <DirectoryExplorer />
      </div>

      <p className="mt-4 text-[11px] text-[var(--color-faint)]">
        {t("structure.sourceNote")}{" "}
        <a
          href="https://code.claude.com/docs/en/claude-directory"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-accent)] underline"
        >
          code.claude.com/docs/en/claude-directory
        </a>
        .
      </p>
    </div>
  );
}
