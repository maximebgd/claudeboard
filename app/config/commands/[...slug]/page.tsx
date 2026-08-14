import { notFound } from "next/navigation";
import { getMdEntry } from "@/lib/mdEntries";
import { isAllowed } from "@/lib/store";
import MdEntryDetail from "@/components/MdEntryDetail";

export const dynamic = "force-dynamic";

export default async function CommandDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const decoded = slug.map(decodeURIComponent).join("/");
  const [entry, canWrite, canDelete] = await Promise.all([
    getMdEntry("commands", decoded),
    isAllowed("commands", "modify"),
    isAllowed("commands", "delete"),
  ]);
  if (!entry) notFound();

  return (
    <MdEntryDetail
      kind="commands"
      entry={entry}
      backHref="/config/commands"
      backLabel="Commandes"
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
