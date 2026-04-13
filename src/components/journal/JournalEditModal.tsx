"use client";

import { useState, useEffect } from "react";
import { updateJournalEntry } from "@/actions/journal-actions";
import { getAccounts } from "@/actions/account-actions";
import { getClients, createClient } from "@/actions/client-actions";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";

interface SubAccount {
  id: number;
  name: string;
  sortOrder: number;
}

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  subAccounts?: SubAccount[];
}

interface EditRow {
  debitAccountId: number;
  debitSubAccountId: number;
  debitAmount: number;
  creditAccountId: number;
  creditSubAccountId: number;
  creditAmount: number;
  description: string;
  allocationPercent: number;
}

interface Client {
  id: number;
  name: string;
  honorific: string;
}

interface EntryData {
  id: number;
  date: Date;
  description: string;
  clientId?: number | null;
  lines: {
    id: number;
    accountId: number;
    subAccountId?: number | null;
    debitAmount: number;
    creditAmount: number;
    description: string | null;
    allocationPercent: number;
    account: { id: number; name: string };
  }[];
}

function toDateStr(d: Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** DB の lines (1行=1科目) を、編集用の「借方+貸方ペア行」にまとめる */
function toEditRows(lines: EntryData["lines"]): EditRow[] {
  const debits = lines.filter((l) => l.debitAmount > 0);
  const credits = lines.filter((l) => l.creditAmount > 0);
  const maxLen = Math.max(debits.length, credits.length, 1);
  const rows: EditRow[] = [];
  for (let i = 0; i < maxLen; i++) {
    const d = debits[i];
    const c = credits[i];
    rows.push({
      debitAccountId: d?.accountId || 0,
      debitSubAccountId: d?.subAccountId || 0,
      debitAmount: d?.debitAmount || 0,
      creditAccountId: c?.accountId || 0,
      creditSubAccountId: c?.subAccountId || 0,
      creditAmount: c?.creditAmount || 0,
      description: d?.description || c?.description || "",
      allocationPercent: d?.allocationPercent ?? c?.allocationPercent ?? 100,
    });
  }
  return rows;
}

export default function JournalEditModal({
  entry,
  onClose,
}: {
  entry: EntryData;
  onClose: () => void;
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number>(entry.clientId || 0);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientLoading, setNewClientLoading] = useState(false);
  const [date, setDate] = useState(toDateStr(entry.date));
  const [description, setDescription] = useState(entry.description);
  const [rows, setRows] = useState<EditRow[]>(() => toEditRows(entry.lines));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAccounts().then(setAccounts);
    getClients().then(setClients);
  }, []);

  const totalDebit = rows.reduce((s, r) => s + r.debitAmount, 0);
  const totalCredit = rows.reduce((s, r) => s + r.creditAmount, 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const updateRow = (idx: number, updates: Partial<EditRow>) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...updates };
        if (updates.debitAccountId !== undefined && updates.debitAccountId !== r.debitAccountId) {
          next.debitSubAccountId = 0;
        }
        if (updates.creditAccountId !== undefined && updates.creditAccountId !== r.creditAccountId) {
          next.creditSubAccountId = 0;
        }
        return next;
      })
    );
  };

  const addRow = () => {
    setRows([...rows, { debitAccountId: 0, debitSubAccountId: 0, debitAmount: 0, creditAccountId: 0, creditSubAccountId: 0, creditAmount: 0, description: "", allocationPercent: 100 }]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== idx));
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    setNewClientLoading(true);
    try {
      const created = await createClient({ name: newClientName.trim() });
      setClients((prev) => [...prev, { id: created.id, name: created.name, honorific: created.honorific }].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(created.id);
      setShowNewClient(false);
      setNewClientName("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "取引先の作成に失敗しました");
    } finally {
      setNewClientLoading(false);
    }
  };

  const handleSave = async () => {
    setError("");
    if (!date) { setError("日付を入力してください"); return; }
    if (!description.trim()) { setError("摘要を入力してください"); return; }
    if (!isBalanced) { setError("借方合計と貸方合計が一致しません"); return; }

    // 補助科目バリデーション
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const debitAcc = accounts.find((a) => a.id === r.debitAccountId);
      if (debitAcc && (debitAcc.subAccounts?.length ?? 0) > 0 && r.debitAmount > 0 && !r.debitSubAccountId) {
        setError(`行${i + 1}: 借方「${debitAcc.name}」の補助科目を選択してください`); return;
      }
      const creditAcc = accounts.find((a) => a.id === r.creditAccountId);
      if (creditAcc && (creditAcc.subAccounts?.length ?? 0) > 0 && r.creditAmount > 0 && !r.creditSubAccountId) {
        setError(`行${i + 1}: 貸方「${creditAcc.name}」の補助科目を選択してください`); return;
      }
    }

    // 行をサーバー形式に変換
    const lines: { accountId: number; subAccountId?: number | null; debitAmount: number; creditAmount: number; description?: string; allocationPercent: number }[] = [];
    for (const row of rows) {
      if (row.debitAccountId > 0 && row.debitAmount > 0) {
        lines.push({
          accountId: row.debitAccountId,
          subAccountId: row.debitSubAccountId || null,
          debitAmount: row.debitAmount,
          creditAmount: 0,
          description: row.description || undefined,
          allocationPercent: row.allocationPercent,
        });
      }
      if (row.creditAccountId > 0 && row.creditAmount > 0) {
        lines.push({
          accountId: row.creditAccountId,
          subAccountId: row.creditSubAccountId || null,
          debitAmount: 0,
          creditAmount: row.creditAmount,
          description: row.description || undefined,
          allocationPercent: row.allocationPercent,
        });
      }
    }

    if (lines.length < 2) { setError("借方と貸方の両方に科目と金額を入力してください"); return; }

    setSaving(true);
    try {
      await updateJournalEntry(entry.id, { date, description: description.trim(), clientId: clientId || null, lines });
      onClose();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  // 勘定科目グループ化
  const grouped: Record<string, Account[]> = {};
  const typeLabels: Record<string, string> = { asset: "資産", liability: "負債", capital: "資本", revenue: "収益", expense: "費用" };
  for (const a of accounts) {
    const lbl = typeLabels[a.type] || a.type;
    if (!grouped[lbl]) grouped[lbl] = [];
    grouped[lbl].push(a);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">仕訳の編集</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

          <div className="grid grid-cols-[150px_1fr] gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">摘要</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">取引先（任意）</label>
            <div className="flex items-center gap-2">
              <select value={clientId} onChange={(e) => setClientId(parseInt(e.target.value))}
                className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value={0}>-- 選択しない --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => { setShowNewClient(true); setNewClientName(""); }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">
                <Plus size={13} />新規
              </button>
            </div>
            {showNewClient && (
              <div className="mt-2 flex items-center gap-2 max-w-sm">
                <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateClient(); } }}
                  placeholder="取引先名" autoFocus
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" disabled={!newClientName.trim() || newClientLoading} onClick={handleCreateClient}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  追加
                </button>
                <button type="button" onClick={() => setShowNewClient(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-700 text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">借方科目</th>
                  <th className="px-3 py-2 text-right font-medium w-24">金額</th>
                  <th className="px-3 py-2 text-left font-medium">貸方科目</th>
                  <th className="px-3 py-2 text-right font-medium w-24">金額</th>
                  <th className="px-3 py-2 text-center font-medium w-16" title="事業用の割合（%）。金額は実額を記録し、ここで事業用の割合を指定します。100=全額事業、50=事業用50%">按分%</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-2 py-2">
                      <select value={row.debitAccountId} onChange={(e) => updateRow(idx, { debitAccountId: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value={0}>-- 借方 --</option>
                        {Object.entries(grouped).map(([g, accs]) => (
                          <optgroup key={g} label={g}>
                            {accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      {(() => {
                        const sel = accounts.find((a) => a.id === row.debitAccountId);
                        const subs = sel?.subAccounts ?? [];
                        if (subs.length === 0) return null;
                        return (
                          <select value={row.debitSubAccountId} onChange={(e) => updateRow(idx, { debitSubAccountId: parseInt(e.target.value) })}
                            className={`mt-1 w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${row.debitSubAccountId ? "border-gray-300" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                            <option value={0}>-- 補助科目 --</option>
                            {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} value={row.debitAmount || ""}
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 0;
                          updateRow(idx, { debitAmount: v, creditAmount: row.creditAmount === 0 ? v : row.creditAmount });
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-2">
                      <select value={row.creditAccountId} onChange={(e) => updateRow(idx, { creditAccountId: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value={0}>-- 貸方 --</option>
                        {Object.entries(grouped).map(([g, accs]) => (
                          <optgroup key={g} label={g}>
                            {accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      {(() => {
                        const sel = accounts.find((a) => a.id === row.creditAccountId);
                        const subs = sel?.subAccounts ?? [];
                        if (subs.length === 0) return null;
                        return (
                          <select value={row.creditSubAccountId} onChange={(e) => updateRow(idx, { creditSubAccountId: parseInt(e.target.value) })}
                            className={`mt-1 w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${row.creditSubAccountId ? "border-gray-300" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                            <option value={0}>-- 補助科目 --</option>
                            {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} value={row.creditAmount || ""}
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 0;
                          updateRow(idx, { creditAmount: v, debitAmount: row.debitAmount === 0 ? v : row.debitAmount });
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input type="number" min={0} max={100} value={row.allocationPercent}
                        onChange={(e) => updateRow(idx, { allocationPercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                        className="w-14 border border-gray-300 rounded px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title="事業用の割合（%）。100=全額事業、50=50%が事業用・50%が私用。金額は実額のままで、ここで割合だけを変更します。" />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600">
                          <X size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr className="border-t border-gray-200">
                  <td className="px-3 py-2 text-right font-medium">合計</td>
                  <td className={`px-3 py-2 text-right font-bold ${isBalanced ? "text-green-600" : "text-red-600"}`}>
                    {totalDebit.toLocaleString()}円
                  </td>
                  <td></td>
                  <td className={`px-3 py-2 text-right font-bold ${isBalanced ? "text-green-600" : "text-red-600"}`}>
                    {totalCredit.toLocaleString()}円
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button type="button" onClick={addRow}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            + 行を追加
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
            キャンセル
          </button>
          <button onClick={handleSave} disabled={saving || !isBalanced}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "保存中..." : "更新"}
          </button>
        </div>
      </div>
    </div>
  );
}
