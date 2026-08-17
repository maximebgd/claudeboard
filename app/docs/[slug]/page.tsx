import { notFound } from "next/navigation";
import { getDoc } from "@/lib/docs";
import { getT } from "@/lib/i18n";
import Markdown from "@/components/Markdown";

export const dynamic = "force-dynamic";

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { locale } = await getT();
  const doc = await getDoc(slug, locale);
  if (!doc) notFound();

  return (
    <article>
      <Markdown>{doc.content}</Markdown>
    </article>
  );
}
