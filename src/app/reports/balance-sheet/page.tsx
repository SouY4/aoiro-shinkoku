import { getBalanceSheet } from "@/actions/report-actions";
import { getSettings } from "@/actions/settings-actions";
import { formatCurrency, toReiwa } from "@/lib/formatters";
import PrintButton from "@/components/PrintButton";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  if (view === "tax") redirect("/reports/tax-return");

  const settings = await getSettings();
  const data = await getBalanceSheet(settings.fiscalYear);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">貸借対照表</h1>
          <p className="text-gray-500 text-sm">{toReiwa(settings.fiscalYear)}年12月31日現在</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/reports/tax-return"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 print:hidden"
          >
            決算書4ページの形式は申告転記シート →
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4 text-center border-b-2 border-gray-300 pb-2">資産の部</h2>
          <table className="w-full text-sm">
            <tbody>
              {data.assets.map((a) => (
                <tr key={a.account} className="border-b border-gray-100">
                  <td className="py-2">{a.account}</td>
                  <td className="py-2 text-right">{formatCurrency(a.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-blue-50">
                <td className="py-3 font-bold">資産合計</td>
                <td className="py-3 text-right font-bold">{formatCurrency(data.totalAssets)}</td>
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

              {data.capital.length > 0 && (
                <>
                  <tr className="bg-gray-50"><td className="py-2 font-semibold" colSpan={2}>資本の部</td></tr>
                  {data.capital.map((c) => (
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
                <td className="py-3 text-right font-bold">{formatCurrency(data.totalLiabilitiesAndCapital)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {data.totalAssets !== data.totalLiabilitiesAndCapital && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          貸借が一致していません。資産合計({formatCurrency(data.totalAssets)}) ≠ 負債・資本合計({formatCurrency(data.totalLiabilitiesAndCapital)})
        </div>
      )}
    </div>
  );
}
