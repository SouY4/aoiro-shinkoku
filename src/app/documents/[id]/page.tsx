import { notFound } from "next/navigation";
import { getDocument } from "@/actions/document-actions";
import { getSettings } from "@/actions/settings-actions";
import DocumentPreview from "@/components/documents/DocumentPreview";
import DocumentActionBar from "@/components/documents/DocumentActionBar";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docId = parseInt(id);
  if (isNaN(docId)) notFound();

  const [doc, settings] = await Promise.all([
    getDocument(docId),
    getSettings(),
  ]);

  if (!doc) notFound();

  return (
    <div>
      <DocumentActionBar docId={doc.id} docType={doc.type} status={doc.status} />
      <DocumentPreview doc={doc} settings={settings} />
    </div>
  );
}
