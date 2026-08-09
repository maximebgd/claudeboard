import { notFound } from "next/navigation";
import { getMdEntry } from "@/lib/mdEntries";
import MdEntryDetail from "@/components/MdEntryDetail";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const decoded = slug.map(decodeURIComponent).join("/");
  const entry = await getMdEntry("agents", decoded);
  if (!entry) notFound();

  return (
    <MdEntryDetail kind="agents" entry={entry} backHref="/config/agents" backLabel="Agents" />
  );
}
