"use client";

import { useState } from "react";
import { aggregateStripeFees, type MonthlyFeeSummary } from "@/lib/stripe-csv";
import {
  findExistingFeeMonths,
  importStripeFees,
  saveStripeImportConfig,
  type StripeImportConfig,
} from "@/actions/stripe-import-actions";

type AccountWithSub = {
  id: number;
  code: string;
  name: string;
  subAccounts: { id: number; name: string }[];
};

interface Props {
  accounts: AccountWithSub[];
  initialConfig: StripeImportConfig;
}

const keyOf = (s: { year: number; month: number }) =>
  `${s.year}-${String(s.month).padStart(2, "0")}`;

export default function StripeImportClient({ accounts, initialConfig }: Props) {
  const [summaries, setSummaries] = useState<MonthlyFeeSummary[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<StripeImportConfig>(initialConfig);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const creditAccount = accounts.find((a) => a.id === config.creditAccountId);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setResult("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = aggregateStripeFees(text);
      setSummaries(parsed);
      const exist = await findExistingFeeMonths(parsed.map((s) => ({ year: s.year, month: s.month })));
      const existSet = new Set(exist);
      setExisting(existSet);
      setChecked(new Set(parsed.filter((s) => s.total > 0 && !existSet.has(keyOf(s))).map(keyOf)));
    } catch (err) {
      setSummaries([]);
      setError(err instanceof Error ? err.message : "CSV の解析に失敗しました");
    }
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleImport() {
    setBusy(true);
    setError("");
    setResult("");
    try {
      await saveStripeImportConfig(config);
      const selected = summaries
        .filter((s) => checked.has(keyOf(s)))
        .map((s) => ({ year: s.year, month: s.month, total: s.total }));
      const res = await importStripeFees(selected, config);
      setResult(`登録 ${res.createdMonths.length} 件 / スキップ ${res.skippedMonths.length} 件`);
      setExisting((prev) => new Set([...prev, ...res.createdMonths]));
      setChecked(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label htmlFor="stripe-csv-input" className="block text-sm font-medium mb-2">
          balance_history.csv を選択
        </label>
        <input id="stripe-csv-input" type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}

      {summaries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">借方科目</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                value={config.debitAccountId}
                onChange={(e) => setConfig({ ...config, debitAccountId: Number(e.target.value) })}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">貸方科目</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                value={config.creditAccountId}
                onChange={(e) =>
                  setConfig({ ...config, creditAccountId: Number(e.target.value), creditSubAccountId: null })
                }
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">貸方 補助科目</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                value={config.creditSubAccountId ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, creditSubAccountId: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">（なし）</option>
                {creditAccount?.subAccounts.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 w-10"></th>
                <th className="py-2">月</th>
                <th className="py-2 text-right">charge手数料</th>
                <th className="py-2 text-right">stripe_fee</th>
                <th className="py-2 text-right">合計</th>
                <th className="py-2">状態</th>
                <th className="py-2 text-right">対象外</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const key = keyOf(s);
                const isExisting = existing.has(key);
                return (
                  <tr key={key} className="border-b border-gray-100">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={checked.has(key)}
                        disabled={s.total <= 0 || isExisting}
                        onChange={() => toggle(key)}
                      />
                    </td>
                    <td className="py-2">{s.year}年{s.month}月</td>
                    <td className="py-2 text-right">{s.chargeFeeTotal.toLocaleString()}円</td>
                    <td className="py-2 text-right">{s.stripeFeeTotal.toLocaleString()}円</td>
                    <td className="py-2 text-right font-medium">{s.total.toLocaleString()}円</td>
                    <td className="py-2">
                      {isExisting ? (
                        <span className="text-amber-600">登録済み</span>
                      ) : (
                        <span className="text-green-600">新規</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-400">{s.ignoredCount}件</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={busy || checked.size === 0}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              選択した月を登録（{checked.size}件）
            </button>
            {result && <span className="text-sm text-gray-700">{result}</span>}
          </div>
          <p className="text-xs text-gray-400">
            ※ 仕訳は「借方 支払手数料 / 貸方 その他の預金〔Stripe残高〕」で各月の末日に登録されます。登録済みの月は二重計上防止のためスキップされます。
          </p>
        </div>
      )}
    </div>
  );
}
