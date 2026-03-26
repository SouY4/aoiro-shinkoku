import { getSettings } from "@/actions/settings-actions";
import { getAccounts } from "@/actions/account-actions";
import { getDepreciationForYear, createDepreciationJournalEntry, getFixedAssets } from "@/actions/fixed-asset-actions";
import { formatCurrency, formatDateShort, toReiwa } from "@/lib/formatters";
import FixedAssetForm from "@/components/fixed-assets/FixedAssetForm";

export const dynamic = "force-dynamic";

export default async function FixedAssetsPage() {
  const settings = await getSettings();
  const fiscalYear = settings.fiscalYear;
  const accounts = await getAccounts();
  const assetAccounts = accounts.filter((a) => a.type === "asset" && a.category === "fixed_asset");
  const expenseAccounts = accounts.filter(
    (a) => a.type === "expense" && (a.code === "6011" || a.name === "減価償却費")
  );
  const depreciationRows = await getDepreciationForYear(fiscalYear);
  const assets = await getFixedAssets();

  async function createDepreciationAction() {
    "use server";
    await createDepreciationJournalEntry(fiscalYear);
  }

  const canCreateDepreciation =
    depreciationRows.some((r) => r.yearAmount > 0 && !r.alreadyRecorded);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">固定資産台帳</h1>
      <p className="text-gray-500 text-sm mb-6">
        {toReiwa(fiscalYear)}度 — 定額法で償却額を計算します
      </p>

      <FixedAssetForm
        assetAccounts={assetAccounts}
        expenseAccounts={expenseAccounts.length > 0 ? expenseAccounts : accounts.filter((a) => a.type === "expense")}
      />

      {/* 減価償却仕訳作成 */}
      {canCreateDepreciation && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800 mb-2">
            {fiscalYear}年度の減価償却仕訳が未作成です。下のボタンで一括仕訳を作成できます（12/31・決算整理仕訳）。
          </p>
          <form action={createDepreciationAction}>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700"
            >
              {fiscalYear}年度の減価償却仕訳を作成
            </button>
          </form>
        </div>
      )}

      {/* 固定資産一覧（台帳） */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">登録資産一覧</h2>
        </div>
        {assets.length === 0 ? (
          <p className="p-6 text-gray-400 text-center">固定資産がまだ登録されていません。上から追加してください。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">資産名</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">取得日</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">取得価額</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-medium">耐用年数</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">資産勘定</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{a.name}</td>
                    <td className="px-4 py-2">{formatDateShort(a.acquisitionDate)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(a.cost)}</td>
                    <td className="px-4 py-2 text-right">{a.usefulLifeYears}年</td>
                    <td className="px-4 py-2">{a.assetAccount.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 減価償却明細（青色申告決算書3ページ目フォーマット） */}
      <div className="bg-white rounded-xl border border-gray-200 mt-6 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{fiscalYear}年度 減価償却の計算</h2>
          <p className="text-xs text-gray-500 mt-1">青色申告決算書 3ページ目「減価償却費の計算」への転記用</p>
        </div>
        {depreciationRows.length === 0 ? (
          <p className="p-6 text-gray-400 text-center">固定資産がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-gray-600 font-medium">
                  <th className="px-3 py-3 text-left">資産名</th>
                  <th className="px-3 py-3 text-center">取得年月</th>
                  <th className="px-3 py-3 text-right">取得価額</th>
                  <th className="px-3 py-3 text-right">償却基礎額</th>
                  <th className="px-3 py-3 text-center">償却方法</th>
                  <th className="px-3 py-3 text-center">耐用年数</th>
                  <th className="px-3 py-3 text-right">本年償却費</th>
                  <th className="px-3 py-3 text-right">未償却残高</th>
                  <th className="px-3 py-3 text-center">仕訳</th>
                </tr>
              </thead>
              <tbody>
                {depreciationRows.map((r) => {
                  const acqDate = new Date(r.acquisitionDate);
                  const acqYM = `${acqDate.getFullYear()}年${acqDate.getMonth() + 1}月`;
                  const methodLabel = r.depreciationMethod === "straight_line" ? "定額法" : r.depreciationMethod;
                  // 定額法（H19改正後）: 償却の基礎となる金額 = 取得価額
                  const depreciationBase = r.cost;
                  return (
                    <tr key={r.assetId} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{acqYM}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.cost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(depreciationBase)}</td>
                      <td className="px-3 py-2 text-center">{methodLabel}</td>
                      <td className="px-3 py-2 text-center">{r.usefulLifeYears}年</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {r.yearAmount > 0 ? formatCurrency(r.yearAmount) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.endBookValue)}</td>
                      <td className="px-3 py-2 text-center">
                        {r.alreadyRecorded ? (
                          <span className="text-green-600">済</span>
                        ) : r.yearAmount > 0 ? (
                          <span className="text-amber-600">未</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-medium">
                  <td className="px-3 py-2" colSpan={6}>合計</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(depreciationRows.reduce((s, r) => s + r.yearAmount, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          ※ 事業専用割合・必要経費算入額の入力欄は今後対応予定。現在は100%で計上されます。
        </p>
      </div>
    </div>
  );
}
