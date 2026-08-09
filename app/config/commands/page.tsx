import { SquareSlash } from "lucide-react";
import { listMdEntries } from "@/lib/mdEntries";
import MdEntryList from "@/components/MdEntryList";

export const dynamic = "force-dynamic";

export default async function CommandsPage() {
  const commands = await listMdEntries("commands");
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
