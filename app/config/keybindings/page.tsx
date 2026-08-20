import { Keyboard } from "lucide-react";
import { readConfigFile } from "@/lib/configFiles";
import { parseKeybindings } from "@/lib/keybindings";
import { formatDate } from "@/lib/claude";
import { isAllowed } from "@/lib/store";
import ConfigEditor from "@/components/ConfigEditor";
import ResetButton from "@/components/ResetButton";
import DeleteButton from "@/components/DeleteButton";
import BackupsPanel from "@/components/BackupsPanel";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const TEMPLATE = `{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "$docs": "https://code.claude.com/docs/en/keybindings",
  "bindings": []
}
`;

export default async function KeybindingsPage() {
  const file = await readConfigFile("keybindings");
  const bindings = parseKeybindings(file.data);
  const [canWrite, canModify, canReset, canDelete, { t, locale }] = await Promise.all([
    isAllowed("keybindings", file.exists ? "modify" : "create"),
    isAllowed("keybindings", "modify"),
    isAllowed("keybindings", "reset"),
    isAllowed("keybindings", "delete"),
    getT(),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Keyboard size={22} className="text-[var(--color-accent)]" />
        {t("sidebar.keybindings")}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {t("keybindings.subtitle")}
        {!file.exists && ` ${t("cfg.fileNotYet")}`}
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {file.path}
        {file.updatedAt ? ` · ${t("common.modifiedOn", { date: formatDate(file.updatedAt, locale) })}` : ""}
      </p>

      {bindings.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-code)] text-left text-xs text-[var(--color-muted)]">
                <th className="px-4 py-2 font-medium">{t("keybindings.key")}</th>
                <th className="px-4 py-2 font-medium">{t("keybindings.command")}</th>
                <th className="px-4 py-2 font-medium">{t("keybindings.context")}</th>
              </tr>
            </thead>
            <tbody>
              {bindings.map((b, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2">
                    <code className="rounded bg-[var(--color-code)] px-1.5 py-0.5 font-mono text-[12px]">
                      {b.key}
                    </code>
                  </td>
                  <td className="px-4 py-2 font-mono text-[12px]">{b.command}</td>
                  <td className="px-4 py-2 text-[12px] text-[var(--color-muted)]">
                    {b.when || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <ConfigEditor
          endpoint="/api/config-file"
          payload={{ target: "keybindings" }}
          initialRaw={file.raw}
          mode="json"
          label="keybindings.json"
          exists={file.exists}
          emptyTemplate={TEMPLATE}
          canWrite={canWrite}
        />
        {file.exists && (
          <div className="mt-4 flex flex-wrap gap-3">
            <ResetButton
              endpoint="/api/config-file"
              body={{ target: "keybindings" }}
              title={t("keybindings.resetTitle")}
              description={t("keybindings.resetDesc")}
              locked={!canReset}
            />
            <DeleteButton
              endpoint="/api/config-file"
              body={{ target: "keybindings" }}
              label={t("common.delete")}
              title={t("keybindings.deleteTitle")}
              description={t("cfg.deleteFileDesc")}
              confirmLabel={t("common.delete")}
              locked={!canDelete}
            />
          </div>
        )}
        <div className="mt-4">
          <BackupsPanel target="keybindings" canRestore={canModify} currentRaw={file.raw} />
        </div>
      </div>
    </div>
  );
}
