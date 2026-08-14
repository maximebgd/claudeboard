import path from "path";
import { Bot } from "lucide-react";
import { listMdEntries } from "@/lib/mdEntries";
import { CLAUDE_DIR } from "@/lib/claude";
import { isAllowed } from "@/lib/store";
import MdEntryList from "@/components/MdEntryList";
import CreateEntryButton from "@/components/CreateEntryButton";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const [agents, canCreate] = await Promise.all([
    listMdEntries("agents"),
    isAllowed("agents", "create"),
  ]);
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Bot size={22} className="text-[var(--color-accent)]" />
        Agents
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {agents.length} agent{agents.length > 1 ? "s" : ""} dans ~/.claude/agents
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {path.join(CLAUDE_DIR, "agents")}
      </p>

      {canCreate && (
        <div className="mt-6">
          <CreateEntryButton
            endpoint="/api/md"
            extraBody={{ kind: "agents" }}
            redirectBase="/config/agents"
            label="Nouvel agent"
            placeholder="mon-agent"
            hint="Minuscules, chiffres, tirets. Un .md pré-rempli sera créé."
          />
        </div>
      )}

      <div className="mt-6">
        <MdEntryList
          entries={agents}
          basePath="/config/agents"
          emptyLabel="Aucun agent trouvé dans ~/.claude/agents."
        />
      </div>
    </div>
  );
}
