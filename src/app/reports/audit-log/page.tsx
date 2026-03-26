import { getAuditLogs } from "@/actions/audit-log-actions";
import AuditLogClient from "@/components/audit/AuditLogClient";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const logs = await getAuditLogs();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">仕訳変更履歴</h1>
      <p className="text-gray-500 text-sm mb-6">
        優良電子帳簿要件: 仕訳の作成・訂正・削除の履歴を記録しています
      </p>
      <AuditLogClient initialLogs={logs} />
    </div>
  );
}
