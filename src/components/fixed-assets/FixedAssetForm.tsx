"use client";

import { useState } from "react";
import { createFixedAsset } from "@/actions/fixed-asset-actions";

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  category: string;
}

export default function FixedAssetForm({
  assetAccounts,
  expenseAccounts,
}: {
  assetAccounts: Account[];
  expenseAccounts: Account[];
}) {
  const [name, setName] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [cost, setCost] = useState("");
  const [usefulLifeYears, setUsefulLifeYears] = useState("");
  const [assetAccountId, setAssetAccountId] = useState(0);
  const [expenseAccountId, setExpenseAccountId] = useState(0);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 少額減価償却資産の特例: 取得日によって上限が異なる（措法28の2）
  // 2026年4月1日以降取得: 40万円未満 / それ以前: 30万円未満
  const smallAssetThreshold = (() => {
    if (!acquisitionDate) return 300_000;
    return new Date(acquisitionDate) >= new Date("2026-04-01") ? 400_000 : 300_000;
  })();
  const costNum = parseInt(cost, 10) || 0;
  const isSmallAsset = costNum > 0 && costNum < smallAssetThreshold;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const costNum = parseInt(cost, 10);
    const yearsNum = parseInt(usefulLifeYears, 10);
    if (!name.trim()) { setError("資産名を入力してください"); return; }
    if (!acquisitionDate) { setError("取得日を入力してください"); return; }
    if (!costNum || costNum <= 0) { setError("取得価額を正しく入力してください"); return; }
    if (!yearsNum || yearsNum <= 0) { setError("耐用年数を正しく入力してください"); return; }
    if (!assetAccountId || !expenseAccountId) { setError("資産勘定と減価償却費勘定を選択してください"); return; }
    setLoading(true);
    try {
      await createFixedAsset({
        name: name.trim(),
        acquisitionDate,
        cost: costNum,
        usefulLifeYears: yearsNum,
        assetAccountId,
        expenseAccountId,
        memo: memo.trim() || undefined,
      });
      setName("");
      setCost("");
      setUsefulLifeYears("");
      setMemo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <h3 className="font-semibold mb-3">固定資産を追加</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">資産名</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="例: パソコン" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">取得日</label>
          <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">取得価額（円）</label>
          <input type="number" min={1} value={cost} onChange={(e) => setCost(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">耐用年数（年）</label>
          <input type="number" min={1} value={usefulLifeYears} onChange={(e) => setUsefulLifeYears(e.target.value)}
            placeholder="例: 5" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">資産勘定</label>
          <select value={assetAccountId} onChange={(e) => setAssetAccountId(parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value={0}>選択</option>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">減価償却費勘定</label>
          <select value={expenseAccountId} onChange={(e) => setExpenseAccountId(parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value={0}>選択</option>
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-600 mb-1">メモ</label>
          <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      {isSmallAsset && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <strong>少額減価償却資産の特例（措法28の2）が適用できます。</strong><br />
          取得価額が{(smallAssetThreshold / 10000).toFixed(0)}万円未満のため、取得年度に全額を経費算入できます。
          その場合はここで固定資産として登録せず、通常の経費仕訳（消耗品費等）として計上してください。
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? "登録中..." : "追加"}
        </button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </form>
  );
}
