"use client";

import { useState, useMemo } from "react";

type AuditLog = {
  id: number;
  journalEntryId: number;
  action: "create" | "update" | "delete";
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  changedAt: string;
};

const ACTION_LABEL: Record<string, { label: string; className: string }> = {
  create: { label: "作成", className: "bg-green-100 text-green-700" },
  update: { label: "訂正", className: "bg-amber-100 text-amber-700" },
  delete: { label: "削除", className: "bg-red-100 text-red-700" },
};

function DataCell({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <span className="text-gray-400 text-xs">—</span>;
  const desc = data.description as string | undefined;
  const date = data.date
    ? new Date(data.date as string).toLocaleDateString("ja-JP")
    : undefined;
  const lines = data.lines as
    | { accountId: number; debitAmount: number; creditAmount: number }[]
    | undefined;
  const totalDebit = lines?.reduce((s, l) => s + (l.debitAmount || 0), 0) ?? 0;
  return (
    <div className="text-xs space-y-0.5">
      {date && <div className="text-gray-500">{date}</div>}
      {desc && <div className="font-medium">{desc}</div>}
      {totalDebit > 0 && (
        <div className="text-gray-500">
          借方合計: &yen;{totalDebit.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default function AuditLogClient({
  initialLogs,
}: {
  initialLogs: AuditLog[];
}) {
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [entryIdFilter, setEntryIdFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    const entryId = entryIdFilter ? parseInt(entryIdFilter, 10) : null;

    return initialLogs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      const d = new Date(log.changedAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (entryId && log.journalEntryId !== entryId) return false;
      return true;
    });
  }, [initialLogs, actionFilter, dateFrom, dateTo, entryIdFilter]);

  const isFiltering = actionFilter || dateFrom || dateTo || entryIdFilter;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* フィルタ */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">操作種別</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              <option value="create">作成</option>
              <option value="update">訂正</option>
              <option value="delete">削除</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">変更日（開始）</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">変更日（終了）</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">仕訳番号</label>
            <input
              type="number"
              value={entryIdFilter}
              onChange={(e) => setEntryIdFilter(e.target.value)}
              placeholder="例: 42"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {filtered.length} / {initialLogs.length} 件
          </span>
          {isFiltering && (
            <button
              type="button"
              onClick={() => {
                setActionFilter("");
                setDateFrom("");
                setDateTo("");
                setEntryIdFilter("");
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              フィルタをクリア
            </button>
          )}
        </div>
      </div>

      {/* テーブル */}
      {filtered.length === 0 ? (
        <p className="p-8 text-center text-gray-400 text-sm">
          {initialLogs.length === 0
            ? "まだ変更履歴がありません。"
            : "条件に一致するログがありません。"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  変更日時
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">
                  操作
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">
                  仕訳番号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  変更前
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  変更後
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">
                  詳細
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const meta = ACTION_LABEL[log.action];
                const isExpanded = expanded === log.id;
                return (
                  <>
                    <tr
                      key={log.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(log.changedAt).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs font-mono text-gray-700">
                        #{log.journalEntryId}
                      </td>
                      <td className="px-4 py-2.5">
                        <DataCell data={log.beforeData} />
                      </td>
                      <td className="px-4 py-2.5">
                        <DataCell data={log.afterData} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded(isExpanded ? null : log.id)
                          }
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {isExpanded ? "閉じる" : "JSON"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr
                        key={`${log.id}-detail`}
                        className="bg-gray-50 border-t border-gray-100"
                      >
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="font-medium text-gray-600 mb-1">
                                変更前データ
                              </div>
                              <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto text-gray-700 whitespace-pre-wrap">
                                {log.beforeData
                                  ? JSON.stringify(log.beforeData, null, 2)
                                  : "null"}
                              </pre>
                            </div>
                            <div>
                              <div className="font-medium text-gray-600 mb-1">
                                変更後データ
                              </div>
                              <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto text-gray-700 whitespace-pre-wrap">
                                {log.afterData
                                  ? JSON.stringify(log.afterData, null, 2)
                                  : "null"}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
