import { notFound } from "next/navigation";
import { getMdEntry } from "@/lib/mdEntries";
import { isAllowed } from "@/lib/store";
import MdEntryDetail from "@/components/MdEntryDetail";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const decoded = slug.map(decodeURIComponent).join("/");
  const [entry, canWrite, canDelete] = await Promise.all([
    getMdEntry("agents", decoded),
    isAllowed("agents", "modify"),
    isAllowed("agents", "delete"),
  ]);
  if (!entry) notFound();

  return (
    <MdEntryDetail
      kind="agents"
      entry={entry}
      backHref="/config/agents"
      backLabel="Agents"
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
