import { FileText } from "lucide-react";
import { readConfigFile } from "@/lib/configFiles";
import { formatDate } from "@/lib/claude";
import { isAllowed } from "@/lib/store";
import ConfigEditor from "@/components/ConfigEditor";
import ResetButton from "@/components/ResetButton";
import DeleteButton from "@/components/DeleteButton";
import BackupsPanel from "@/components/BackupsPanel";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ClaudeMdPage() {
  const file = await readConfigFile("claudeMd");
  // Fichier présent → permission « modify » ; absent → « create ».
  const [canWrite, canModify, canReset, canDelete, { t, locale }] = await Promise.all([
    isAllowed("claudeMd", file.exists ? "modify" : "create"),
    isAllowed("claudeMd", "modify"),
    isAllowed("claudeMd", "reset"),
    isAllowed("claudeMd", "delete"),
    getT(),
  ]);

  // Template de création, dans la langue de l'UI.
  const template = `# ${t("claudeMd.template.title")}\n\n${t("claudeMd.template.intro")}\n\n`;

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <FileText size={22} className="text-[var(--color-accent)]" />
        {t("claudeMd.title")}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {t("claudeMd.subtitle")}
        {!file.exists && ` ${t("cfg.fileNotYet")}`}
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {file.path}
        {file.updatedAt ? ` · ${t("common.modifiedOn", { date: formatDate(file.updatedAt, locale) })}` : ""}
      </p>

      <div className="mt-6">
        <ConfigEditor
          endpoint="/api/config-file"
          payload={{ target: "claudeMd" }}
          initialRaw={file.raw}
          mode="markdown"
          label="CLAUDE.md"
          exists={file.exists}
          emptyTemplate={template}
          canWrite={canWrite}
        />
        {file.exists && (
          <div className="mt-4 flex flex-wrap gap-3">
            <ResetButton
              endpoint="/api/config-file"
              body={{ target: "claudeMd" }}
              title={t("claudeMd.resetTitle")}
              description={t("claudeMd.resetDesc")}
              locked={!canReset}
            />
            <DeleteButton
              endpoint="/api/config-file"
              body={{ target: "claudeMd" }}
              label={t("common.delete")}
              title={t("claudeMd.deleteTitle")}
              description={t("cfg.deleteFileDesc")}
              confirmLabel={t("common.delete")}
              locked={!canDelete}
            />
          </div>
        )}
        <div className="mt-4">
          <BackupsPanel target="claudeMd" canRestore={canModify} currentRaw={file.raw} />
        </div>
      </div>
    </div>
  );
}
