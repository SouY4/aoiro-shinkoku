"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateDocument, deleteDocument, convertDocument, duplicateDocument } from "@/actions/document-actions";
import { getDocumentStatusLabel, getDocumentTypeLabel } from "@/lib/formatters";
import { Printer, Pencil, Trash2, Copy, ArrowRightLeft, ChevronDown } from "lucide-react";

const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

type Props = {
  docId: number;
  docType: string;
  status: string;
};

export default function DocumentActionBar({ docId, docType, status }: Props) {
  const router = useRouter();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showConvertMenu, setShowConvertMenu] = useState(false);

  const statusOptions = docType === "invoice"
    ? ["draft", "sent", "paid", "cancelled"]
    : ["draft", "sent", "cancelled"];

  const changeStatus = async (newStatus: string) => {
    await updateDocument(docId, { status: newStatus });
    setShowStatusMenu(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("この書類を削除しますか？")) return;
    await deleteDocument(docId);
    router.push("/documents");
  };

  const handleDuplicate = async () => {
    const doc = await duplicateDocument(docId);
    router.push(`/documents/${doc.id}`);
  };

  const handleConvert = async (targetType: string) => {
    setShowConvertMenu(false);
    const doc = await convertDocument(docId, targetType);
    router.push(`/documents/${doc.id}`);
  };

  const convertOptions: { type: string; label: string }[] = [];
  if (docType === "quotation") {
    convertOptions.push({ type: "delivery", label: "納品書に変換" });
    convertOptions.push({ type: "invoice", label: "請求書に変換" });
  } else if (docType === "delivery") {
    convertOptions.push({ type: "invoice", label: "請求書に変換" });
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-3 mb-6 p-4 bg-white rounded-xl border border-gray-200">
      {/* ステータス */}
      <div className="relative">
        <button onClick={() => { setShowStatusMenu(!showStatusMenu); setShowConvertMenu(false); }}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium ${STATUS_BADGE_COLORS[status] || ""}`}>
          {getDocumentStatusLabel(status)}
          <ChevronDown size={14} />
        </button>
        {showStatusMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
            {statusOptions.map((s) => (
              <button key={s} onClick={() => changeStatus(s)}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${s === status ? "font-bold" : ""}`}>
                {getDocumentStatusLabel(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* 印刷 */}
      <button onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
        <Printer size={14} /> 印刷
      </button>

      {/* 編集 */}
      <Link href={`/documents/${docId}/edit`}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
        <Pencil size={14} /> 編集
      </Link>

      {/* 変換 */}
      {convertOptions.length > 0 && (
        <div className="relative">
          <button onClick={() => { setShowConvertMenu(!showConvertMenu); setShowStatusMenu(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            <ArrowRightLeft size={14} /> 変換 <ChevronDown size={12} />
          </button>
          {showConvertMenu && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
              {convertOptions.map((opt) => (
                <button key={opt.type} onClick={() => handleConvert(opt.type)}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 複製 */}
      <button onClick={handleDuplicate}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
        <Copy size={14} /> 複製
      </button>

      {/* 削除 */}
      <button onClick={handleDelete}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100">
        <Trash2 size={14} /> 削除
      </button>
    </div>
  );
}
