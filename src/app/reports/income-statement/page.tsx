import { getIncomeStatement, getMonthlySales } from "@/actions/report-actions";
import { getSettings } from "@/actions/settings-actions";
import { formatCurrency, toReiwa } from "@/lib/formatters";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function IncomeStatementPage() {
  const settings = await getSettings();
  const [data, monthly] = await Promise.all([
    getIncomeStatement(settings.fiscalYear),
    getMonthlySales(settings.fiscalYear),
  ]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">損益計算書</h1>
          <p className="text-gray-500 text-sm">{toReiwa(settings.fiscalYear)}度 (自 {settings.fiscalYear}年1月1日 至 {settings.fiscalYear}年12月31日)</p>
        </div>
        <PrintButton />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b-2 border-gray-300">
              <td className="py-3 font-bold text-lg" colSpan={2}>売上（収入）金額</td>
              <td className="py-3 text-right font-bold text-lg">{formatCurrency(data.totalRevenue)}</td>
            </tr>

            {data.revenue.map((r) => (
              <tr key={r.account} className="border-b border-gray-100">
                <td className="py-2 pl-4" colSpan={2}>{r.account}</td>
                <td className="py-2 text-right">{formatCurrency(r.amount)}</td>
              </tr>
            ))}

            {data.cogs.length > 0 && (
              <>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <td className="py-3 font-semibold" colSpan={2}>売上原価</td>
                  <td className="py-3 text-right font-semibold">{formatCurrency(data.totalCogs)}</td>
                </tr>
                {data.cogs.map((c) => (
                  <tr key={c.account} className="border-b border-gray-100">
                    <td className="py-2 pl-4" colSpan={2}>{c.account}</td>
                    <td className="py-2 text-right">{formatCurrency(c.amount)}</td>
                  </tr>
                ))}
              </>
            )}

            <tr className="border-b-2 border-gray-300 bg-blue-50">
              <td className="py-3 font-bold" colSpan={2}>差引金額（売上総利益）</td>
              <td className="py-3 text-right font-bold">{formatCurrency(data.grossProfit)}</td>
            </tr>

            <tr className="border-b border-gray-200 bg-gray-50">
              <td className="py-3 font-semibold" colSpan={2}>経費</td>
              <td className="py-3 text-right font-semibold">{formatCurrency(data.totalExpenses)}</td>
            </tr>

            {data.expenses.map((e) => (
              <tr key={e.account} className="border-b border-gray-100">
                <td className="py-2 pl-4" colSpan={2}>{e.account}</td>
                <td className="py-2 text-right">{formatCurrency(e.amount)}</td>
              </tr>
            ))}

            <tr className="border-b border-gray-300 bg-gray-50">
              <td className="py-3 font-semibold" colSpan={2}>差引金額</td>
              <td className="py-3 text-right font-semibold">{formatCurrency(data.operatingIncome)}</td>
            </tr>

            <tr className="border-b border-gray-200">
              <td className="py-3 pl-4" colSpan={2}>青色申告特別控除額</td>
              <td className="py-3 text-right text-blue-700">{formatCurrency(data.blueReturnDeduction)}</td>
            </tr>

            <tr className="border-b-2 border-blue-500 bg-blue-50">
              <td className="py-4 font-bold text-lg text-blue-800" colSpan={2}>所得金額</td>
              <td className="py-4 text-right font-bold text-lg text-blue-800">{formatCurrency(data.netIncome)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 月別売上集計（青色申告決算書2ページ目） */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6 print:mt-8">
        <h2 className="text-base font-semibold mb-1">月別売上集計</h2>
        <p className="text-xs text-gray-500 mb-4">青色申告決算書 2ページ目「月別売上（収入）金額及び仕入金額」の転記用</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300 text-right">
              <th className="py-2 text-left font-medium text-gray-600">月</th>
              <th className="py-2 font-medium text-gray-600">売上高</th>
              {monthly.hasCogs && <th className="py-2 font-medium text-gray-600">仕入高</th>}
            </tr>
          </thead>
          <tbody>
            {monthly.months.map(({ month, revenue, cogs }) => (
              <tr key={month} className="border-b border-gray-100 text-right">
                <td className="py-2 text-left text-gray-700">{month}月</td>
                <td className={`py-2 tabular-nums ${revenue === 0 ? "text-gray-300" : ""}`}>
                  {formatCurrency(revenue)}
                </td>
                {monthly.hasCogs && (
                  <td className={`py-2 tabular-nums ${cogs === 0 ? "text-gray-300" : ""}`}>
                    {formatCurrency(cogs)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 text-right font-bold">
              <td className="py-3 text-left">合計</td>
              <td className="py-3 tabular-nums">{formatCurrency(monthly.totalRevenue)}</td>
              {monthly.hasCogs && <td className="py-3 tabular-nums">{formatCurrency(monthly.totalCogs)}</td>}
            </tr>
            <tr className="text-right text-xs text-gray-500">
              <td className="pt-1 pb-2 text-left" colSpan={monthly.hasCogs ? 3 : 2}>
                ※ 合計は損益計算書の売上（収入）金額 {formatCurrency(data.totalRevenue)} と一致します
                {monthly.totalRevenue !== data.totalRevenue && (
                  <span className="text-red-600 ml-2">⚠ 不一致 — 仕訳データを確認してください</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
