import path from "path";
import { SquareSlash } from "lucide-react";
import { listMdEntries } from "@/lib/mdEntries";
import { CLAUDE_DIR } from "@/lib/claude";
import { isAllowed } from "@/lib/store";
import MdEntryList from "@/components/MdEntryList";
import CreateEntryButton from "@/components/CreateEntryButton";

export const dynamic = "force-dynamic";

export default async function CommandsPage() {
  const [commands, canCreate] = await Promise.all([
    listMdEntries("commands"),
    isAllowed("commands", "create"),
  ]);
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <SquareSlash size={22} className="text-[var(--color-accent)]" />
        Commandes
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {commands.length} commande{commands.length > 1 ? "s" : ""} dans ~/.claude/commands.
        Les sous-dossiers forment des namespaces de slash-commands.
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {path.join(CLAUDE_DIR, "commands")}
      </p>

      {canCreate && (
        <div className="mt-6">
          <CreateEntryButton
            endpoint="/api/md"
            extraBody={{ kind: "commands" }}
            redirectBase="/config/commands"
            label="Nouvelle commande"
            placeholder="ma-commande ou namespace/ma-commande"
            hint="Minuscules, chiffres, tirets ; « / » pour un namespace. Un .md pré-rempli sera créé."
          />
        </div>
      )}

      <div className="mt-6">
        <MdEntryList
          entries={commands}
          basePath="/config/commands"
          emptyLabel="Aucune commande custom trouvée dans ~/.claude/commands."
        />
      </div>
    </div>
  );
}
