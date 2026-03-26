import { notFound } from "next/navigation";
import { getDocument } from "@/actions/document-actions";
import { getClients } from "@/actions/client-actions";
import DocumentForm from "@/components/documents/DocumentForm";

export const dynamic = "force-dynamic";

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docId = parseInt(id);
  if (isNaN(docId)) notFound();

  const [doc, clients] = await Promise.all([
    getDocument(docId),
    getClients(),
  ]);

  if (!doc) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">書類編集</h1>
      <DocumentForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        initialDocument={{
          id: doc.id,
          type: doc.type,
          clientId: doc.clientId,
          issueDate: doc.issueDate,
          dueDate: doc.dueDate,
          subject: doc.subject,
          notes: doc.notes,
          taxRate: doc.taxRate,
          lines: doc.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
          })),
        }}
      />
    </div>
  );
}
