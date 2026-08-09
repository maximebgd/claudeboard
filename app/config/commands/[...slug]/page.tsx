import { notFound } from "next/navigation";
import { getMdEntry } from "@/lib/mdEntries";
import MdEntryDetail from "@/components/MdEntryDetail";

export const dynamic = "force-dynamic";

export default async function CommandDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const decoded = slug.map(decodeURIComponent).join("/");
  const entry = await getMdEntry("commands", decoded);
  if (!entry) notFound();

  return (
    <MdEntryDetail
      kind="commands"
      entry={entry}
      backHref="/config/commands"
      backLabel="Commandes"
    />
  );
}
