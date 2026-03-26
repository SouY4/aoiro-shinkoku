"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDateShort } from "@/lib/formatters";

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface LedgerEntry {
  date: string;
  description: string;
  counterAccount: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  isCarryForward?: boolean;
}

export default function LedgerClient({ accounts, fiscalYear }: { accounts: Account[]; fiscalYear: number }) {
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const grouped: Record<string, Account[]> = {};
  const labels: Record<string, string> = { asset: "資産", liability: "負債", capital: "資本", revenue: "収益", expense: "費用" };
  for (const a of accounts) {
    const lbl = labels[a.type] || a.type;
    if (!grouped[lbl]) grouped[lbl] = [];
    grouped[lbl].push(a);
  }

  useEffect(() => {
    if (!selectedAccountId) { setEntries([]); return; }
    setLoading(true);
    fetch(`/api/ledger?accountId=${selectedAccountId}&fiscalYear=${fiscalYear}`)
      .then((r) => r.json())
      .then((data) => setEntries(data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [selectedAccountId, fiscalYear]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">勘定科目を選択</label>
        <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(parseInt(e.target.value))}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={0}>-- 勘定科目を選択 --</option>
          {Object.entries(grouped).map(([g, accs]) => (
            <optgroup key={g} label={g}>
              {accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {loading && <p className="p-6 text-gray-400 text-center">読み込み中...</p>}

      {!loading && selectedAccountId > 0 && entries.length === 0 && (
        <p className="p-6 text-gray-400 text-center">この勘定科目の取引はありません</p>
      )}

      {!loading && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">日付</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">相手科目</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">摘要</th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">借方</th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">貸方</th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">残高</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={idx} className={`border-t border-gray-100 hover:bg-gray-50 ${entry.isCarryForward ? "bg-blue-50/50 font-medium" : ""}`}>
                  <td className="px-4 py-2 text-gray-500">{entry.date}</td>
                  <td className="px-4 py-2">{entry.counterAccount}</td>
                  <td className="px-4 py-2">{entry.description}</td>
                  <td className="px-4 py-2 text-right">{entry.debitAmount > 0 ? formatCurrency(entry.debitAmount) : ""}</td>
                  <td className="px-4 py-2 text-right">{entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : ""}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(entry.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
