"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteDocument, convertDocument, duplicateDocument } from "@/actions/document-actions";
import { formatCurrency, formatDateShort, getDocumentTypeLabel, getDocumentStatusLabel } from "@/lib/formatters";
import { Plus, Trash2, Copy, ArrowRightLeft } from "lucide-react";

type DocRow = {
  id: number;
  type: string;
  documentNumber: string;
  issueDate: Date;
  subject: string | null;
  status: string;
  total: number;
  client: { id: number; name: string };
};

type ClientRow = {
  id: number;
  name: string;
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  invoice: "bg-blue-100 text-blue-800",
  quotation: "bg-green-100 text-green-800",
  delivery: "bg-amber-100 text-amber-800",
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function DocumentList({ documents, clients }: { documents: DocRow[]; clients: ClientRow[] }) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  const filtered = documents.filter((d) => {
    if (typeFilter && d.type !== typeFilter) return false;
    if (statusFilter && d.status !== statusFilter) return false;
    if (clientFilter && d.client.id !== parseInt(clientFilter)) return false;
    return true;
  });

  const handleDelete = async (id: number) => {
    if (!confirm("この書類を削除しますか？")) return;
    await deleteDocument(id);
    router.refresh();
  };

  const handleDuplicate = async (id: number) => {
    await duplicateDocument(id);
    router.refresh();
  };

  const handleConvert = async (id: number, targetType: string) => {
    const doc = await convertDocument(id, targetType);
    router.push(`/documents/${doc.id}`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">書類一覧 ({filtered.length}件)</h2>
        <Link href="/documents/new"
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus size={14} /> 新規作成
        </Link>
      </div>

      {/* フィルター */}
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-3">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">全種別</option>
          <option value="invoice">請求書</option>
          <option value="quotation">見積書</option>
          <option value="delivery">納品書</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">全ステータス</option>
          <option value="draft">下書き</option>
          <option value="sent">送付済み</option>
          <option value="paid">入金済み</option>
          <option value="cancelled">取消</option>
        </select>
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">全取引先</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="p-6 text-gray-400 text-center">
          {documents.length === 0
            ? "書類がまだ作成されていません。「新規作成」から書類を作成してください。"
            : "フィルター条件に一致する書類がありません。"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">番号</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">種別</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">発行日</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">取引先</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">件名</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">合計金額</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">ステータス</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/documents/${doc.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                      {doc.documentNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE_COLORS[doc.type] || ""}`}>
                      {getDocumentTypeLabel(doc.type)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatDateShort(doc.issueDate)}</td>
                  <td className="px-4 py-2 font-medium">{doc.client.name}</td>
                  <td className="px-4 py-2 text-gray-700">{doc.subject || "-"}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(doc.total)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_COLORS[doc.status] || ""}`}>
                      {getDocumentStatusLabel(doc.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => handleDuplicate(doc.id)} className="text-gray-500 hover:text-blue-600" title="複製">
                        <Copy size={13} />
                      </button>
                      {doc.type === "quotation" && (
                        <button onClick={() => handleConvert(doc.id, "invoice")} className="text-gray-500 hover:text-green-600" title="請求書に変換">
                          <ArrowRightLeft size={13} />
                        </button>
                      )}
                      {doc.type === "delivery" && (
                        <button onClick={() => handleConvert(doc.id, "invoice")} className="text-gray-500 hover:text-green-600" title="請求書に変換">
                          <ArrowRightLeft size={13} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(doc.id)} className="text-gray-500 hover:text-red-600" title="削除">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
