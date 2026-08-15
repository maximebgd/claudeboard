import { Keyboard } from "lucide-react";
import { readConfigFile } from "@/lib/configFiles";
import { parseKeybindings } from "@/lib/keybindings";
import { formatDate } from "@/lib/claude";
import { isAllowed } from "@/lib/store";
import ConfigEditor from "@/components/ConfigEditor";
import ResetButton from "@/components/ResetButton";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

const TEMPLATE = `{
  "keybindings": [

  ]
}
`;

export default async function KeybindingsPage() {
  const file = await readConfigFile("keybindings");
  const bindings = parseKeybindings(file.data);
  const [canWrite, canReset, canDelete] = await Promise.all([
    isAllowed("keybindings", file.exists ? "modify" : "create"),
    isAllowed("keybindings", "reset"),
    isAllowed("keybindings", "delete"),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Keyboard size={22} className="text-[var(--color-accent)]" />
        Keybindings
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Raccourcis clavier custom (~/.claude/keybindings.json).
        {!file.exists && " Le fichier n'existe pas encore."}
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {file.path}
        {file.updatedAt ? ` · modifié le ${formatDate(file.updatedAt)}` : ""}
      </p>

      {bindings.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-code)] text-left text-xs text-[var(--color-muted)]">
                <th className="px-4 py-2 font-medium">Touche</th>
                <th className="px-4 py-2 font-medium">Commande</th>
                <th className="px-4 py-2 font-medium">Contexte</th>
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
              title="Réinitialiser keybindings.json ?"
              description="Le fichier est ramené à une liste de keybindings vide. Un backup horodaté (.bak) est créé au préalable."
              locked={!canReset}
            />
            <DeleteButton
              endpoint="/api/config-file"
              body={{ target: "keybindings" }}
              label="Supprimer"
              title="Supprimer keybindings.json ?"
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
