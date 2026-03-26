import { getClients } from "@/actions/client-actions";
import ClientManager from "@/components/clients/ClientManager";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await getClients(true);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">取引先管理</h1>
      <ClientManager clients={clients} />
    </div>
  );
}
