import { listDocs } from "@/lib/docs";
import DocsNav from "@/components/DocsNav";

export const dynamic = "force-dynamic";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = await listDocs();
  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-8 py-10">
      <aside className="w-52 shrink-0">
        <div className="sticky top-10">
          <DocsNav docs={docs} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
