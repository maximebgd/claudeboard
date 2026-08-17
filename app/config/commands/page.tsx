import path from "path";
import { SquareSlash } from "lucide-react";
import { listMdEntries } from "@/lib/mdEntries";
import { CLAUDE_DIR } from "@/lib/claude";
import { isAllowed } from "@/lib/store";
import MdEntryList from "@/components/MdEntryList";
import CreateEntryButton from "@/components/CreateEntryButton";
import { getT } from "@/lib/i18n";
import { tPlural } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

export default async function CommandsPage() {
  const [commands, canCreate, { t }] = await Promise.all([
    listMdEntries("commands"),
    isAllowed("commands", "create"),
    getT(),
  ]);
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <SquareSlash size={22} className="text-[var(--color-accent)]" />
        {t("sidebar.commands")}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {tPlural(t, "commands.count", commands.length)}
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {path.join(CLAUDE_DIR, "commands")}
      </p>

      <div className="mt-6">
        <CreateEntryButton
          endpoint="/api/md"
          extraBody={{ kind: "commands" }}
          redirectBase="/config/commands"
          label={t("commands.new")}
          placeholder={t("commands.slugPlaceholder")}
          hint={t("commands.createHint")}
          locked={!canCreate}
        />
      </div>

      <div className="mt-6">
        <MdEntryList
          entries={commands}
          basePath="/config/commands"
          emptyLabel={t("commands.empty")}
        />
      </div>
    </div>
  );
}
