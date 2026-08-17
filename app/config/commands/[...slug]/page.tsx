import { notFound } from "next/navigation";
import { getMdEntry } from "@/lib/mdEntries";
import { isAllowed } from "@/lib/store";
import { getT } from "@/lib/i18n";
import MdEntryDetail from "@/components/MdEntryDetail";

export const dynamic = "force-dynamic";

export default async function CommandDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const decoded = slug.map(decodeURIComponent).join("/");
  const [entry, canWrite, canDelete, { t }] = await Promise.all([
    getMdEntry("commands", decoded),
    isAllowed("commands", "modify"),
    isAllowed("commands", "delete"),
    getT(),
  ]);
  if (!entry) notFound();

  return (
    <MdEntryDetail
      kind="commands"
      entry={entry}
      backHref="/config/commands"
      backLabel={t("sidebar.commands")}
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
