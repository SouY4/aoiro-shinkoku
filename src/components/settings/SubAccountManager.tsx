"use client";

import { useState, useTransition } from "react";
import { createSubAccount, updateSubAccount, deleteSubAccount } from "@/actions/account-actions";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Check } from "lucide-react";

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
  subAccounts: SubAccount[];
}

const TYPE_LABELS: Record<string, string> = {
  asset: "資産",
  liability: "負債",
  capital: "資本",
  revenue: "収益",
  expense: "費用",
};

export default function SubAccountManager({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedAccountId, setSelectedAccountId] = useState<number>(
    () => accounts.find((a) => a.code === "1004")?.id ?? accounts[0]?.id ?? 0
  );
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");

  const selected = accounts.find((a) => a.id === selectedAccountId);
  const subs = selected?.subAccounts ?? [];

  const grouped: Record<string, Account[]> = {};
  for (const a of accounts) {
    const lbl = TYPE_LABELS[a.type] || a.type;
    if (!grouped[lbl]) grouped[lbl] = [];
    grouped[lbl].push(a);
  }

  const handleAdd = () => {
    if (!newName.trim() || !selectedAccountId) return;
    setError("");
    startTransition(async () => {
      try {
        await createSubAccount(selectedAccountId, newName);
        setNewName("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "追加に失敗しました");
      }
    });
  };

  const handleSaveEdit = (id: number) => {
    if (!editingName.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        await updateSubAccount(id, editingName);
        setEditingId(null);
        setEditingName("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新に失敗しました");
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`補助科目「${name}」を削除しますか？\n（使用中の場合は非表示化されます）`)) return;
    setError("");
    startTransition(async () => {
      try {
        await deleteSubAccount(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "削除に失敗しました");
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">補助科目（口座の内訳）</h2>
      <p className="text-xs text-gray-500 mb-4">
        例：「その他の預金」の下に「銀行口座」「Stripe残高」を作っておくと、決算書は1行のままで、帳簿上は口座別に残高を確認できます。
      </p>

      {error && <div className="mb-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">対象科目</label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(parseInt(e.target.value))}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(grouped).map(([label, accs]) => (
            <optgroup key={label} label={label}>
              {accs.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {subs.length > 0 ? (
        <ul className="mb-4 divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-3 py-2">
              {editingId === s.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(s.id); } }}
                    autoFocus
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => handleSaveEdit(s.id)} disabled={isPending} className="text-green-600 hover:text-green-800 mr-1">
                    <Check size={16} />
                  </button>
                  <button type="button" onClick={() => { setEditingId(null); setEditingName(""); }} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { setEditingId(s.id); setEditingName(s.name); }} className="text-gray-400 hover:text-blue-600">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => handleDelete(s.id, s.name)} disabled={isPending} className="text-gray-400 hover:text-red-600">
                      <X size={16} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400 mb-4">この科目には補助科目が登録されていません。</p>
      )}

      <div className="flex items-center gap-2 max-w-md">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="新しい補助科目名（例：銀行口座、Stripe残高）"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !newName.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40"
        >
          <Plus size={14} />追加
        </button>
      </div>
    </div>
  );
}
