import { getClients } from "@/actions/client-actions";
import DocumentForm from "@/components/documents/DocumentForm";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  const clients = await getClients();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">書類作成</h1>
      <DocumentForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
