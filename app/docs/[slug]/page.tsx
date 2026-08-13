import { notFound } from "next/navigation";
import { getDoc } from "@/lib/docs";
import Markdown from "@/components/Markdown";

export const dynamic = "force-dynamic";

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) notFound();

  return (
    <article>
      <Markdown>{doc.content}</Markdown>
    </article>
  );
}
