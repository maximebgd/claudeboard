import path from "path";
import { Bot } from "lucide-react";
import { listMdEntries } from "@/lib/mdEntries";
import { CLAUDE_DIR } from "@/lib/claude";
import MdEntryList from "@/components/MdEntryList";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await listMdEntries("agents");
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
