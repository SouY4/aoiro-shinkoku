import { getSettings, updateSettings } from "@/actions/settings-actions";
import { createBackup, listBackups, getBackupDir } from "@/actions/backup-actions";
import { performYearEndCarryover, getCarryoverPreview } from "@/actions/fiscal-year-actions";
import { getAccounts } from "@/actions/account-actions";
import SettingsForm from "@/components/settings/SettingsForm";
import SubAccountManager from "@/components/settings/SubAccountManager";
import { formatCurrency, toReiwa } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const backups = await listBackups();
  const preview = await getCarryoverPreview(settings.fiscalYear);
  const backupDir = await getBackupDir();
  const accounts = await getAccounts();

  async function handleBackup() {
    "use server";
    await createBackup();
  }

  async function handleCarryover() {
    "use server";
    const s = await getSettings();
    await performYearEndCarryover(s.fiscalYear);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-6">設定</h1>
        <SettingsForm initialSettings={settings} />
      </div>

      <SubAccountManager accounts={accounts} />

      {/* バックアップ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-1">データバックアップ</h2>
        <p className="text-xs text-gray-500 mb-4">
          帳簿データは7年間の保存義務があります。確定申告後など、定期的にバックアップを作成してください。<br />
          保存先: <code className="bg-gray-100 px-1 rounded">{backupDir}</code>
        </p>
        <form action={handleBackup} className="mb-4">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            バックアップを作成
          </button>
        </form>
        {backups.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600 font-medium text-xs">ファイル名</th>
                <th className="px-3 py-2 text-right text-gray-600 font-medium text-xs">サイズ</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium text-xs">作成日時</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{b.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-600">{b.sizeKB} KB</td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {new Date(b.createdAt).toLocaleString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-gray-400">バックアップはまだありません。</p>
        )}
      </div>

      {/* 年度繰越 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-1">年度繰越</h2>
        <p className="text-xs text-gray-500 mb-4">
          {toReiwa(settings.fiscalYear)}度（{settings.fiscalYear}年）の決算が確定したら実行してください。
          事業主借・事業主貸を元入金に振替し、会計年度を{settings.fiscalYear + 1}年に更新します。
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-sm mb-4 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">元入金（期末残高）</span>
            <span className="tabular-nums">{formatCurrency(preview.motoireBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">+ 事業主借（振替）</span>
            <span className="tabular-nums text-blue-600">{formatCurrency(preview.jigyonushiKariBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">− 事業主貸（振替）</span>
            <span className="tabular-nums text-red-600">△{formatCurrency(preview.jigyonushiKashiBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">+ 当期純利益</span>
            <span className={`tabular-nums ${preview.netIncome < 0 ? "text-red-600" : "text-green-600"}`}>
              {preview.netIncome < 0 ? "△" : ""}{formatCurrency(Math.abs(preview.netIncome))}
            </span>
          </div>
          <div className="flex justify-between font-bold border-t border-gray-200 pt-1 mt-1">
            <span>翌年度 元入金</span>
            <span className="tabular-nums">{formatCurrency(preview.newMotoire)}</span>
          </div>
        </div>
        <form action={handleCarryover}>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700"
            onClick={undefined}
          >
            {settings.fiscalYear}年度 → {settings.fiscalYear + 1}年度 に繰越実行
          </button>
        </form>
        <p className="mt-2 text-xs text-red-600">
          ⚠ 繰越後は会計年度が自動的に{settings.fiscalYear + 1}年に変更されます。確定申告完了後に実行してください。
        </p>
      </div>
    </div>
  );
}
