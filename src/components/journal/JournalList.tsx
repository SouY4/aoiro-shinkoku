"use client";

import { useState, useMemo } from "react";
import { deleteJournalEntry, createReversalEntry } from "@/actions/journal-actions";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
import { useRouter } from "next/navigation";
import ReceiptUploadButton from "@/components/journal/ReceiptUploadButton";
import ReceiptItem from "@/components/journal/ReceiptItem";
import JournalEditModal from "@/components/journal/JournalEditModal";

type LineData = {
  id: number;
  accountId: number;
  account: { id: number; name: string };
  debitAmount: number;
  creditAmount: number;
  description: string | null;
  allocationPercent: number;
};

type EntryData = {
  id: number;
  date: Date;
  description: string;
  isAdjusting: boolean;
  lines: LineData[];
  receipts: { id: number; originalName: string }[];
};

function toPairedRows(lines: LineData[]) {
  const debits = lines.filter((l) => l.debitAmount > 0);
  const credits = lines.filter((l) => l.creditAmount > 0);
  const maxLen = Math.max(debits.length, credits.length);
  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push({ debit: debits[i] || null, credit: credits[i] || null });
  }
  return rows;
}

export default function JournalList({ entries }: { entries: EntryData[] }) {
  const router = useRouter();
  const [editEntry, setEditEntry] = useState<EntryData | null>(null);

  // 検索フィルタ state
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [accountName, setAccountName] = useState("");
  const [keyword, setKeyword] = useState("");

  // クライアントサイドフィルタリング（日付・金額範囲 + 科目 + 摘要の複合検索）
  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    const minAmt = amountMin ? parseInt(amountMin, 10) : null;
    const maxAmt = amountMax ? parseInt(amountMax, 10) : null;
    const acct = accountName.trim().toLowerCase();
    const kw = keyword.trim().toLowerCase();

    return entries.filter((e) => {
      const d = new Date(e.date);
      if (from && d < from) return false;
      if (to && d > to) return false;

      if (acct) {
        const hasAcct = e.lines.some((l) => l.account.name.toLowerCase().includes(acct));
        if (!hasAcct) return false;
      }

      if (kw && !e.description.toLowerCase().includes(kw)) return false;

      if (minAmt !== null || maxAmt !== null) {
        const maxLine = Math.max(...e.lines.map((l) => Math.max(l.debitAmount, l.creditAmount)));
        if (minAmt !== null && maxLine < minAmt) return false;
        if (maxAmt !== null && maxLine > maxAmt) return false;
      }

      return true;
    });
  }, [entries, dateFrom, dateTo, amountMin, amountMax, accountName, keyword]);

  const isFiltering = dateFrom || dateTo || amountMin || amountMax || accountName || keyword;

  const handleDelete = async (id: number) => {
    if (!confirm("この仕訳を削除しますか？")) return;
    await deleteJournalEntry(id);
    router.refresh();
  };

  const handleReversal = async (id: number) => {
    await createReversalEntry(id);
    router.refresh();
  };

  if (entries.length === 0) {
    return (
      <p className="p-6 text-gray-400 text-center">まだ仕訳がありません。上のフォームから仕訳を入力してください。</p>
    );
  }

  return (
    <>
      {/* 検索フィルタ（優良電子帳簿: 日付・金額範囲・複合検索要件） */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">日付（開始）</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">日付（終了）</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">金額（下限）</label>
            <input type="number" min={0} value={amountMin} onChange={(e) => setAmountMin(e.target.value)}
              placeholder="0" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">金額（上限）</label>
            <input type="number" min={0} value={amountMax} onChange={(e) => setAmountMax(e.target.value)}
              placeholder="上限なし" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">科目名</label>
            <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)}
              placeholder="例: 通信費" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">摘要キーワード</label>
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
              placeholder="例: GitHub" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {isFiltering ? `${filtered.length} / ${entries.length} 件` : `${entries.length} 件`}
          </span>
          {isFiltering && (
            <button type="button"
              onClick={() => { setDateFrom(""); setDateTo(""); setAmountMin(""); setAmountMax(""); setAccountName(""); setKeyword(""); }}
              className="text-xs text-blue-600 hover:underline">
              フィルタをクリア
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-white">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">日付</th>
              <th className="px-4 py-2.5 text-left font-medium">借方科目</th>
              <th className="px-4 py-2.5 text-right font-medium">金額</th>
              <th className="px-4 py-2.5 text-left font-medium">貸方科目</th>
              <th className="px-4 py-2.5 text-right font-medium">金額</th>
              <th className="px-4 py-2.5 text-left font-medium">摘要</th>
              <th className="px-4 py-2.5 text-center font-medium">領収書</th>
              <th className="px-4 py-2.5 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">条件に一致する仕訳がありません</td></tr>
            ) : null}
            {filtered.map((entry) => {
              const pairedRows = toPairedRows(entry.lines);
              return pairedRows.map((row, idx) => (
                <tr
                  key={`${entry.id}-${idx}`}
                  className={`border-t ${idx === 0 ? "border-gray-300" : "border-gray-100"} hover:bg-gray-50 ${entry.isAdjusting ? "bg-amber-50/50" : ""}`}
                >
                  {/* 日付 (1行目のみ) */}
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                    {idx === 0 ? formatDateShort(entry.date) : ""}
                  </td>
                  {/* 借方科目 */}
                  <td className="px-4 py-2 font-medium">
                    {row.debit ? row.debit.account.name : ""}
                  </td>
                  {/* 借方金額 */}
                  <td className="px-4 py-2 text-right">
                    {row.debit ? formatCurrency(row.debit.debitAmount) : ""}
                  </td>
                  {/* 貸方科目 */}
                  <td className="px-4 py-2 font-medium">
                    {row.credit ? row.credit.account.name : ""}
                  </td>
                  {/* 貸方金額 */}
                  <td className="px-4 py-2 text-right">
                    {row.credit ? formatCurrency(row.credit.creditAmount) : ""}
                  </td>
                  {/* 摘要 (1行目のみ) */}
                  <td className="px-4 py-2 text-gray-700">
                    {idx === 0 ? (
                      <span>
                        {entry.isAdjusting && <span className="text-amber-600 text-xs mr-1">[訂正]</span>}
                        {entry.description}
                      </span>
                    ) : ""}
                  </td>
                  {/* 領収書 (1行目のみ) */}
                  <td className="px-4 py-2 text-center">
                    {idx === 0 && (
                      <div className="flex flex-col items-center gap-0.5">
                        {entry.receipts.length > 0 && (
                          <span className="flex flex-wrap justify-center gap-1">
                            {entry.receipts.map((r) => (
                              <ReceiptItem key={r.id} id={r.id} name={r.originalName} />
                            ))}
                          </span>
                        )}
                        <ReceiptUploadButton journalEntryId={entry.id} />
                      </div>
                    )}
                  </td>
                  {/* 操作 (1行目のみ) */}
                  <td className="px-4 py-2 text-center">
                    {idx === 0 && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditEntry(entry)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                          title="仕訳を編集（按分変更など）"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReversal(entry.id)}
                          className="text-amber-600 hover:text-amber-800 text-xs"
                          title="逆仕訳（訂正仕訳）を自動作成"
                        >
                          訂正
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {editEntry && (
        <JournalEditModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
        />
      )}
    </>
  );
}
