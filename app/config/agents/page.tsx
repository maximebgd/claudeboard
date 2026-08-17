import path from "path";
import { Bot } from "lucide-react";
import { listMdEntries } from "@/lib/mdEntries";
import { CLAUDE_DIR } from "@/lib/claude";
import { isAllowed } from "@/lib/store";
import MdEntryList from "@/components/MdEntryList";
import CreateEntryButton from "@/components/CreateEntryButton";
import { getT } from "@/lib/i18n";
import { tPlural } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const [agents, canCreate, { t }] = await Promise.all([
    listMdEntries("agents"),
    isAllowed("agents", "create"),
    getT(),
  ]);
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Bot size={22} className="text-[var(--color-accent)]" />
        {t("sidebar.agents")}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {tPlural(t, "agents.count", agents.length)}
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {path.join(CLAUDE_DIR, "agents")}
      </p>

      <div className="mt-6">
        <CreateEntryButton
          endpoint="/api/md"
          extraBody={{ kind: "agents" }}
          redirectBase="/config/agents"
          label={t("agents.new")}
          placeholder={t("agents.slugPlaceholder")}
          hint={t("agents.createHint")}
          locked={!canCreate}
        />
      </div>

      <div className="mt-6">
        <MdEntryList
          entries={agents}
          basePath="/config/agents"
          emptyLabel={t("agents.empty")}
        />
      </div>
    </div>
  );
}
