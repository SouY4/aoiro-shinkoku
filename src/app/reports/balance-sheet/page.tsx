import { getBalanceSheet } from "@/actions/report-actions";
import { getSettings } from "@/actions/settings-actions";
import { formatCurrency, toReiwa } from "@/lib/formatters";
import PrintButton from "@/components/PrintButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const settings = await getSettings();
  const data = await getBalanceSheet(settings.fiscalYear);
  const { view } = await searchParams;
  const isTaxView = view === "tax";

  // 決算書用表示: 事業主貸を資産の部から除いて資本の部に△表示
  const jigyonushiKashi = data.assets.find((a) => a.account === "事業主貸");
  const jigyonushiKashiAmount = jigyonushiKashi?.amount ?? 0;

  const displayAssets = isTaxView
    ? data.assets.filter((a) => a.account !== "事業主貸")
    : data.assets;
  const displayTotalAssets = isTaxView
    ? data.totalAssets - jigyonushiKashiAmount
    : data.totalAssets;

  // 資本の部に事業主貸を△追加（負の資本として）
  const displayCapital = isTaxView && jigyonushiKashiAmount > 0
    ? [...data.capital, { account: "事業主貸（△）", amount: -jigyonushiKashiAmount }]
    : data.capital;
  const displayTotalCapital = isTaxView
    ? data.capital.reduce((s, c) => s + c.amount, 0) - jigyonushiKashiAmount
    : data.capital.reduce((s, c) => s + c.amount, 0);
  const displayTotalLiabilitiesAndCapital = isTaxView
    ? data.totalLiabilities + displayTotalCapital
    : data.totalLiabilitiesAndCapital;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">貸借対照表</h1>
          <p className="text-gray-500 text-sm">{toReiwa(settings.fiscalYear)}年12月31日現在</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm print:hidden">
            <Link
              href="/reports/balance-sheet"
              className={`px-3 py-1.5 ${!isTaxView ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              通常表示
            </Link>
            <Link
              href="/reports/balance-sheet?view=tax"
              className={`px-3 py-1.5 ${isTaxView ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              決算書用
            </Link>
          </div>
          <PrintButton />
        </div>
      </div>

      {isTaxView && jigyonushiKashiAmount > 0 && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs print:hidden">
          決算書用表示: 事業主貸（{formatCurrency(jigyonushiKashiAmount)}）を資産の部から除き、資本の部に△表示しています。青色申告決算書4ページ目への転記時はこの表示を参照してください。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4 text-center border-b-2 border-gray-300 pb-2">資産の部</h2>
          <table className="w-full text-sm">
            <tbody>
              {displayAssets.map((a) => (
                <tr key={a.account} className="border-b border-gray-100">
                  <td className="py-2">{a.account}</td>
                  <td className="py-2 text-right">{formatCurrency(a.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-blue-50">
                <td className="py-3 font-bold">資産合計</td>
                <td className="py-3 text-right font-bold">{formatCurrency(displayTotalAssets)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4 text-center border-b-2 border-gray-300 pb-2">負債・資本の部</h2>
          <table className="w-full text-sm">
            <tbody>
              {data.liabilities.length > 0 && (
                <>
                  <tr className="bg-gray-50"><td className="py-2 font-semibold" colSpan={2}>負債の部</td></tr>
                  {data.liabilities.map((l) => (
                    <tr key={l.account} className="border-b border-gray-100">
                      <td className="py-2 pl-4">{l.account}</td>
                      <td className="py-2 text-right">{formatCurrency(l.amount)}</td>
                    </tr>
                  ))}
                </>
              )}
              <tr className="border-b border-gray-200">
                <td className="py-2 font-medium">負債合計</td>
                <td className="py-2 text-right font-medium">{formatCurrency(data.totalLiabilities)}</td>
              </tr>

              {displayCapital.length > 0 && (
                <>
                  <tr className="bg-gray-50"><td className="py-2 font-semibold" colSpan={2}>資本の部</td></tr>
                  {displayCapital.map((c) => (
                    <tr key={c.account} className="border-b border-gray-100">
                      <td className="py-2 pl-4">{c.account}</td>
                      <td className={`py-2 text-right ${c.amount < 0 ? "text-red-600" : ""}`}>
                        {c.amount < 0 ? `△${formatCurrency(-c.amount)}` : formatCurrency(c.amount)}
                      </td>
                    </tr>
                  ))}
                </>
              )}

              <tr className="border-t-2 border-gray-300 bg-blue-50">
                <td className="py-3 font-bold">負債・資本合計</td>
                <td className="py-3 text-right font-bold">{formatCurrency(displayTotalLiabilitiesAndCapital)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {displayTotalAssets !== displayTotalLiabilitiesAndCapital && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          貸借が一致していません。資産合計({formatCurrency(displayTotalAssets)}) ≠ 負債・資本合計({formatCurrency(displayTotalLiabilitiesAndCapital)})
        </div>
      )}
    </div>
  );
}
