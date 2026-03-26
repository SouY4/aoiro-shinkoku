import { getDocuments } from "@/actions/document-actions";
import { getClients } from "@/actions/client-actions";
import { getSettings } from "@/actions/settings-actions";
import DocumentList from "@/components/documents/DocumentList";
import { toReiwa } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const settings = await getSettings();
  const [documents, clients] = await Promise.all([
    getDocuments({ fiscalYear: settings.fiscalYear }),
    getClients(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">書類管理</h1>
      <p className="text-gray-500 text-sm mb-6">{toReiwa(settings.fiscalYear)}度</p>
      <DocumentList documents={documents} clients={clients} />
    </div>
  );
}
