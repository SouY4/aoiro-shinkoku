"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDocument, updateDocument } from "@/actions/document-actions";
import { createClient } from "@/actions/client-actions";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Trash2, X } from "lucide-react";

type ClientOption = { id: number; name: string };

type LineState = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

type InitialDoc = {
  id: number;
  type: string;
  clientId: number;
  issueDate: Date;
  dueDate: Date | null;
  subject: string | null;
  notes: string | null;
  taxRate: number;
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }[];
};

function toDateString(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DocumentForm({
  clients,
  initialDocument,
}: {
  clients: ClientOption[];
  initialDocument?: InitialDoc;
}) {
  const router = useRouter();
  const isEdit = !!initialDocument;

  const today = new Date().toISOString().split("T")[0];
  const [type, setType] = useState(initialDocument?.type || "invoice");
  const [clientId, setClientId] = useState(initialDocument?.clientId?.toString() || "");
  const [issueDate, setIssueDate] = useState(initialDocument ? toDateString(initialDocument.issueDate) : today);
  const [dueDate, setDueDate] = useState(initialDocument?.dueDate ? toDateString(initialDocument.dueDate) : "");
  const [subject, setSubject] = useState(initialDocument?.subject || "");
  const [notes, setNotes] = useState(initialDocument?.notes || "");
  const [defaultTaxRate, setDefaultTaxRate] = useState(initialDocument?.taxRate ?? 10);
  const [lines, setLines] = useState<LineState[]>(
    initialDocument?.lines?.length
      ? initialDocument.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        }))
      : [{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // New client inline form
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientHonorific, setNewClientHonorific] = useState("御中");
  const [clientList, setClientList] = useState(clients);

  const addLine = () => {
    setLines([...lines, { description: "", quantity: 1, unitPrice: 0, taxRate: defaultTaxRate }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof LineState, value: string | number) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  // Calculated totals — インボイス制度準拠: 端数処理は税率ごとに1回
  const subtotal = lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPrice), 0);
  const taxByRate = new Map<number, number>();
  for (const l of lines) {
    const amt = Math.round(l.quantity * l.unitPrice);
    taxByRate.set(l.taxRate, (taxByRate.get(l.taxRate) || 0) + amt);
  }
  let taxAmount = 0;
  for (const [rate, rateSubtotal] of taxByRate) {
    taxAmount += Math.floor(rateSubtotal * rate / 100);
  }
  const total = subtotal + taxAmount;

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const c = await createClient({ name: newClientName, honorific: newClientHonorific });
      setClientList([...clientList, { id: c.id, name: c.name }]);
      setClientId(String(c.id));
      setShowNewClient(false);
      setNewClientName("");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "取引先の作成に失敗しました");
    }
  };

  const handleSubmit = async () => {
    setError("");
    setSaving(true);
    try {
      if (isEdit && initialDocument) {
        await updateDocument(initialDocument.id, {
          clientId: parseInt(clientId),
          issueDate,
          dueDate: dueDate || null,
          subject,
          notes,
          taxRate: defaultTaxRate,
          lines: lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
          })),
        });
        router.push(`/documents/${initialDocument.id}`);
      } else {
        const doc = await createDocument({
          type,
          clientId: parseInt(clientId),
          issueDate,
          dueDate: dueDate || undefined,
          subject: subject || undefined,
          notes: notes || undefined,
          taxRate: defaultTaxRate,
          lines: lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
          })),
        });
        router.push(`/documents/${doc.id}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* 書類種別 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">書類種別</label>
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={isEdit}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
            <option value="invoice">請求書</option>
            <option value="quotation">見積書</option>
            <option value="delivery">納品書</option>
          </select>
        </div>

        {/* 取引先 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">取引先</label>
          <div className="flex gap-2">
            <select value={clientId} onChange={(e) => {
              if (e.target.value === "__new__") { setShowNewClient(true); setClientId(""); }
              else { setClientId(e.target.value); setShowNewClient(false); }
            }}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">選択してください</option>
              {clientList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ 新規追加...</option>
            </select>
          </div>
          {showNewClient && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg flex gap-2 items-end">
              <div className="flex-1">
                <input placeholder="取引先名" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <select value={newClientHonorific} onChange={(e) => setNewClientHonorific(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm">
                <option value="御中">御中</option>
                <option value="様">様</option>
              </select>
              <button onClick={handleCreateClient} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">追加</button>
              <button onClick={() => setShowNewClient(false)} className="text-gray-500 hover:text-gray-700"><X size={16} /></button>
            </div>
          )}
        </div>

        {/* 発行日 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">発行日</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* 支払期限（請求書のみ） */}
        {type === "invoice" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">支払期限</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}

        {/* 件名 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">件名</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="例: 2026年2月分 Web制作費"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* 明細テーブル */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">明細</label>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">
              デフォルト税率:
              <select value={defaultTaxRate} onChange={(e) => setDefaultTaxRate(parseInt(e.target.value))}
                className="ml-1 border border-gray-300 rounded px-1.5 py-0.5 text-xs">
                <option value={10}>10%</option>
                <option value={8}>8%</option>
                <option value={0}>0%（非課税）</option>
              </select>
            </label>
          </div>
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 w-2/5">品名</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 w-20">数量</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">単価</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 w-16">税率</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">金額</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const amount = Math.round(line.quantity * line.unitPrice);
                return (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-2 py-1.5">
                      <input value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)}
                        placeholder="品名・内容"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} step={0.01} value={line.quantity}
                        onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} value={line.unitPrice}
                        onChange={(e) => updateLine(idx, "unitPrice", parseInt(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={line.taxRate} onChange={(e) => updateLine(idx, "taxRate", parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value={10}>10%</option>
                        <option value={8}>8%</option>
                        <option value={0}>0%</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(amount)}</td>
                    <td className="px-2 py-1.5 text-center">
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={addLine}
          className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
          <Plus size={14} /> 行を追加
        </button>

        {/* 合計 */}
        <div className="mt-3 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">小計</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">消費税</span>
              <span className="font-medium">{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-1">
              <span className="font-bold">合計金額</span>
              <span className="font-bold text-lg">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 備考 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="振込手数料はお客様ご負担でお願いいたします。"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* 送信 */}
      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? "保存中..." : isEdit ? "更新" : "保存"}
        </button>
        <button onClick={() => router.back()}
          className="px-6 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">
          キャンセル
        </button>
      </div>
    </div>
  );
}
