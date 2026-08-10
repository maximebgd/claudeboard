import { FolderTree } from "lucide-react";
import DirectoryExplorer from "@/components/DirectoryExplorer";

export const metadata = {
  title: "Structure du dossier · Claudeboard",
};

export default function DirectoryPage() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <FolderTree size={22} className="text-[var(--color-accent)]" />
        Structure du dossier
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Où Claude Code lit CLAUDE.md, settings.json, hooks, skills, commandes,
        sous-agents, workflows, rules et l&apos;auto-mémoire — dans le{" "}
        <code className="rounded bg-[var(--color-code)] px-1.5 py-0.5 font-mono text-[var(--color-fg)]">
          .claude/
        </code>{" "}
        de ton projet et dans{" "}
        <code className="rounded bg-[var(--color-code)] px-1.5 py-0.5 font-mono text-[var(--color-fg)]">
          ~/.claude
        </code>{" "}
        de ton dossier personnel. Clique sur un fichier de l&apos;arbre pour voir
        son rôle, quand il se charge, et un exemple.
      </p>

      <div className="mt-6">
        <DirectoryExplorer />
      </div>

      <p className="mt-4 text-[11px] text-[var(--color-faint)]">
        Reproduit d&apos;après la doc officielle{" "}
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
