import { Settings } from "lucide-react";
import { readConfigFile, type ConfigTarget } from "@/lib/configFiles";
import { formatDate } from "@/lib/claude";
import { isAllowed } from "@/lib/store";
import ConfigEditor from "@/components/ConfigEditor";
import ResetButton from "@/components/ResetButton";

export const dynamic = "force-dynamic";

const EMPTY_LOCAL = `{\n  \n}\n`;

export default async function SettingsPage() {
  const [user, local, canWrite, canReset] = await Promise.all([
    readConfigFile("settings"),
    readConfigFile("settingsLocal"),
    isAllowed("settings", "modify"),
    isAllowed("settings", "reset"),
  ]);

  const blocks: {
    target: ConfigTarget;
    file: typeof user;
    title: string;
    subtitle: string;
    empty?: string;
  }[] = [
    {
      target: "settings",
      file: user,
      title: "settings.json",
      subtitle: "Paramètres utilisateur : model, permissions, env, hooks, statusLine…",
    },
    {
      target: "settingsLocal",
      file: local,
      title: "settings.local.json",
      subtitle: "Surcharges locales (non versionnées). Créé à la demande.",
      empty: EMPTY_LOCAL,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Settings size={22} className="text-[var(--color-accent)]" />
        Settings Claude
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Édition des fichiers de configuration de ~/.claude. Chaque écriture crée un backup horodaté.
      </p>

      <div className="mt-8 flex flex-col gap-10">
        {blocks.map(({ target, file, title, subtitle, empty }) => (
          <section key={target}>
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium">{title}</h2>
                {!file.exists && (
                  <span className="rounded bg-[var(--color-code)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                    absent
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">{subtitle}</p>
              <p className="mt-1 text-[11px] text-[var(--color-faint)] font-mono">
                {file.path}
                {file.updatedAt ? ` · modifié le ${formatDate(file.updatedAt)}` : ""}
              </p>
            </div>
            <ConfigEditor
              endpoint="/api/config-file"
              payload={{ target }}
              initialRaw={file.raw}
              mode="json"
              label={title}
              exists={file.exists}
              emptyTemplate={empty}
              canWrite={canWrite}
            />
            {file.exists && (
              <div className="mt-4">
                <ResetButton
                  endpoint="/api/config-file"
                  body={{ target }}
                  label="Réinitialiser"
                  title={`Réinitialiser ${title} ?`}
                  description="Le fichier est ramené à un objet JSON vide. Un backup horodaté (.bak) est créé au préalable."
                  locked={!canReset}
                  detail={
                    <div className="rounded-lg bg-[var(--color-inset)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)] font-mono">
                      {title}
                    </div>
                  }
                />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
