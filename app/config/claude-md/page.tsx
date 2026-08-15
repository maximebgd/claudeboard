import { FileText } from "lucide-react";
import { readConfigFile } from "@/lib/configFiles";
import { formatDate } from "@/lib/claude";
import { isAllowed } from "@/lib/store";
import ConfigEditor from "@/components/ConfigEditor";
import ResetButton from "@/components/ResetButton";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

const TEMPLATE = `# Instructions globales

Ces instructions s'appliquent à toutes tes sessions Claude Code.

`;

export default async function ClaudeMdPage() {
  const file = await readConfigFile("claudeMd");
  // Fichier présent → permission « modify » ; absent → « create ».
  const [canWrite, canReset, canDelete] = await Promise.all([
    isAllowed("claudeMd", file.exists ? "modify" : "create"),
    isAllowed("claudeMd", "reset"),
    isAllowed("claudeMd", "delete"),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <FileText size={22} className="text-[var(--color-accent)]" />
        CLAUDE.md global
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Instructions globales chargées dans chaque session (~/.claude/CLAUDE.md).
        {!file.exists && " Le fichier n'existe pas encore."}
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {file.path}
        {file.updatedAt ? ` · modifié le ${formatDate(file.updatedAt)}` : ""}
      </p>

      <div className="mt-6">
        <ConfigEditor
          endpoint="/api/config-file"
          payload={{ target: "claudeMd" }}
          initialRaw={file.raw}
          mode="markdown"
          label="CLAUDE.md"
          exists={file.exists}
          emptyTemplate={TEMPLATE}
          canWrite={canWrite}
        />
        {file.exists && (
          <div className="mt-4 flex flex-wrap gap-3">
            <ResetButton
              endpoint="/api/config-file"
              body={{ target: "claudeMd" }}
              title="Réinitialiser le CLAUDE.md global ?"
              description="Le fichier est ramené à un modèle vide. Un backup horodaté (.bak) est créé au préalable."
              locked={!canReset}
            />
            <DeleteButton
              endpoint="/api/config-file"
              body={{ target: "claudeMd" }}
              label="Supprimer"
              title="Supprimer le CLAUDE.md global ?"
              description="Le fichier est déplacé dans la corbeille de claudeboard (.claudeboard-trash) — réversible à la main."
              confirmLabel="Supprimer"
              locked={!canDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}
