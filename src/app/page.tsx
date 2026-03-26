import { getSettings } from "@/actions/settings-actions";
import { getBusinessSummary } from "@/actions/report-actions";
import { getRecentEntries } from "@/actions/journal-actions";
import { calculateThresholds } from "@/lib/threshold-calculator";
import { formatCurrency, formatDateShort, toReiwa } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const settings = await getSettings();
  const summary = await getBusinessSummary(settings.fiscalYear);
  const recentEntries = await getRecentEntries(5);

  const thresholds = calculateThresholds({
    salaryRevenue: settings.salaryRevenue,
    businessRevenue: summary.totalRevenue,
    businessExpenses: summary.totalExpenses,
    blueReturnLevel: settings.blueReturnLevel,
    age: 19,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">ダッシュボード</h1>
      <p className="text-gray-500 text-sm mb-6">{toReiwa(settings.fiscalYear)}度 ({settings.fiscalYear}年)</p>

      {/* 収入の壁ダッシュボード */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-blue-700">収入の壁ダッシュボード</h2>
        <p className="text-sm text-gray-500 mb-4">
          給与収入: {formatCurrency(settings.salaryRevenue)}
          {settings.salaryRevenue === 0 && (
            <span className="ml-2 text-amber-600">（設定ページで給与収入を入力してください）</span>
          )}
        </p>

        <div className="space-y-4">
          {thresholds.map((t) => {
            const bgColor = t.isExceeded ? "bg-red-50" : t.percentage > 80 ? "bg-amber-50" : "bg-green-50";
            const barColor = t.isExceeded ? "bg-red-500" : t.percentage > 80 ? "bg-amber-500" : t.percentage > 60 ? "bg-yellow-500" : "bg-green-500";

            return (
              <div key={t.name} className={`rounded-lg p-4 ${bgColor}`}>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-medium text-sm">{t.nameJa}</span>
                    <span className="text-xs text-gray-500 ml-2">({t.basis})</span>
                  </div>
                  <div className="text-right">
                    {t.isExceeded ? (
                      <span className="text-red-600 font-bold text-sm">超過</span>
                    ) : (
                      <span className="text-sm">
                        残り <span className="font-bold text-blue-700">{formatCurrency(t.remaining)}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(100, t.percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatCurrency(t.currentAmount)}</span>
                  <span>{formatCurrency(t.threshold)}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{t.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 事業収支サマリーと最近の仕訳 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">事業収支サマリー</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-600">売上高</dt>
              <dd className="font-medium">{formatCurrency(summary.totalRevenue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">経費合計</dt>
              <dd className="font-medium text-red-600">-{formatCurrency(summary.totalExpenses)}</dd>
            </div>
            <hr className="border-gray-200" />
            <div className="flex justify-between">
              <dt className="text-gray-600 font-medium">差引金額</dt>
              <dd className="font-bold">{formatCurrency(summary.operatingIncome)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">青色申告特別控除後</dt>
              <dd className="font-bold text-blue-700">{formatCurrency(summary.netIncome)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">最近の仕訳</h2>
          {recentEntries.length === 0 ? (
            <p className="text-gray-400 text-sm">まだ仕訳がありません</p>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="border-b border-gray-100 pb-2 last:border-0">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{formatDateShort(entry.date)}</span>
                    <span className="font-medium">
                      {formatCurrency(entry.lines.reduce((s, l) => s + l.debitAmount, 0))}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{entry.description}</p>
                  <p className="text-xs text-gray-400">
                    {entry.lines.map((l) => l.account.name).join(" / ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
