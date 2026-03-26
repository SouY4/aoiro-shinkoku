"use client";

import { useState } from "react";
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  createInventoryJournalEntry,
} from "@/actions/inventory-actions";
import { formatCurrency } from "@/lib/formatters";

interface Item {
  id: number;
  fiscalYear: number;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
}

export default function InventoryTable({
  fiscalYear,
  initialItems,
  totalAmount,
}: {
  fiscalYear: number;
  initialItems: Item[];
  totalAmount: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(totalAmount);
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalMessage, setJournalMessage] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const name = newName.trim();
    if (!name) { setError("品目名を入力してください"); return; }
    const quantity = parseFloat(newQuantity) || 0;
    const unitPrice = parseInt(newUnitPrice, 10) || 0;
    const amount = newAmount ? parseInt(newAmount, 10) : Math.round(quantity * unitPrice);
    setLoading(true);
    try {
      const created = await createInventoryItem({
        fiscalYear,
        name,
        quantity,
        unitPrice,
        amount,
      });
      setItems([...items, { ...created, quantity, unitPrice, amount: created.amount }]);
      setTotal((t) => t + created.amount);
      setNewName("");
      setNewQuantity("");
      setNewUnitPrice("");
      setNewAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: number, field: "name" | "quantity" | "unitPrice" | "amount", value: string | number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const num = typeof value === "string" ? (field === "name" ? value : parseFloat(value) || 0) : value;
    if (field === "name") {
      await updateInventoryItem(id, { name: value as string });
      setItems(items.map((i) => (i.id === id ? { ...i, name: value as string } : i)));
    } else if (field === "quantity" || field === "unitPrice") {
      const quantity = field === "quantity" ? (num as number) : item.quantity;
      const unitPrice = field === "unitPrice" ? (num as number) : item.unitPrice;
      const amount = Math.round(quantity * unitPrice);
      await updateInventoryItem(id, { quantity, unitPrice, amount });
      setItems((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, quantity, unitPrice, amount } : i));
        setTotal(next.reduce((s, i) => s + i.amount, 0));
        return next;
      });
    } else {
      const amount = Math.round(num as number);
      await updateInventoryItem(id, { amount });
      setItems((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, amount } : i));
        setTotal(next.reduce((s, i) => s + i.amount, 0));
        return next;
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この行を削除しますか？")) return;
    await deleteInventoryItem(id);
    const deleted = items.find((i) => i.id === id);
    setItems(items.filter((i) => i.id !== id));
    if (deleted) setTotal((t) => t - deleted.amount);
  };

  const handleCreateJournal = async () => {
    if (total <= 0) { setJournalMessage("合計が0円です。品目を追加してください。"); return; }
    setJournalMessage("");
    setJournalLoading(true);
    try {
      await createInventoryJournalEntry(fiscalYear, total);
      setJournalMessage("仕訳を作成しました。仕訳帳で確認してください。");
    } catch (err) {
      setJournalMessage(err instanceof Error ? err.message : "仕訳の作成に失敗しました");
    } finally {
      setJournalLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-lg font-semibold">{fiscalYear}年度 期末棚卸表</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600">合計: <span className="font-bold text-blue-700">{formatCurrency(total)}</span></p>
          <button type="button" onClick={handleCreateJournal} disabled={journalLoading || total <= 0}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
            {journalLoading ? "作成中..." : "期末棚卸高の仕訳を作成"}
          </button>
        </div>
      </div>
      {journalMessage && (
        <p className={`px-4 py-2 text-sm ${journalMessage.startsWith("仕訳") ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}`}>
          {journalMessage}
        </p>
      )}

      <form onSubmit={handleAdd} className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-end">
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="品目名" className="border border-gray-300 rounded px-2 py-1.5 text-sm w-32" />
        <input type="number" step="any" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)}
          placeholder="数量" className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24 text-right" />
        <input type="number" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)}
          placeholder="単価" className="border border-gray-300 rounded px-2 py-1.5 text-sm w-28 text-right" />
        <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
          placeholder="金額（直接入力可）" className="border border-gray-300 rounded px-2 py-1.5 text-sm w-32 text-right" />
        <button type="submit" disabled={loading}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? "追加中..." : "行を追加"}
        </button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-600 font-medium">品目名</th>
              <th className="px-4 py-3 text-right text-gray-600 font-medium">数量</th>
              <th className="px-4 py-3 text-right text-gray-600 font-medium">単価（円）</th>
              <th className="px-4 py-3 text-right text-gray-600 font-medium">金額（円）</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <input type="text" value={item.name} onChange={(e) => handleUpdate(item.id, "name", e.target.value)}
                    onBlur={(e) => { if (e.target.value !== item.name) handleUpdate(item.id, "name", e.target.value); }}
                    className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 text-sm" />
                </td>
                <td className="px-4 py-2 text-right">
                  <input type="number" step="any" value={item.quantity || ""}
                    onChange={(e) => setItems(items.map((i) => (i.id === item.id ? { ...i, quantity: parseFloat(e.target.value) || 0 } : i)))}
                    onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== item.quantity) handleUpdate(item.id, "quantity", v); }}
                    className="w-20 border border-gray-200 rounded px-1 py-0.5 text-sm text-right" />
                </td>
                <td className="px-4 py-2 text-right">
                  <input type="number" value={item.unitPrice || ""}
                    onChange={(e) => setItems(items.map((i) => (i.id === item.id ? { ...i, unitPrice: parseInt(e.target.value, 10) || 0 } : i)))}
                    onBlur={(e) => { const v = parseInt(e.target.value, 10) || 0; if (v !== item.unitPrice) handleUpdate(item.id, "unitPrice", v); }}
                    className="w-24 border border-gray-200 rounded px-1 py-0.5 text-sm text-right" />
                </td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                <td className="px-4 py-2">
                  <button type="button" onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:text-red-700 text-xs">削除</button>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3 font-medium" colSpan={3}>合計</td>
                <td className="px-4 py-3 text-right font-bold">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
