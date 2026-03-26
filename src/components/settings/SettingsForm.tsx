"use client";

import { useState } from "react";
import { updateSettings } from "@/actions/settings-actions";
import { useRouter } from "next/navigation";

interface Props {
  initialSettings: {
    fiscalYear: number;
    userName: string;
    businessName: string;
    salaryRevenue: number;
    isStudent: boolean;
    blueReturnLevel: 65 | 55;
    address: string;
    postalCode: string;
    phone: string;
    email: string;
    bankName: string;
    bankBranch: string;
    bankAccountType: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
    invoiceRegistrationNumber: string;
  };
}

export default function SettingsForm({ initialSettings }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings({
        fiscalYear: String(settings.fiscalYear),
        userName: settings.userName,
        businessName: settings.businessName,
        salaryRevenue: String(settings.salaryRevenue),
        isStudent: String(settings.isStudent),
        blueReturnLevel: String(settings.blueReturnLevel),
        address: settings.address,
        postalCode: settings.postalCode,
        phone: settings.phone,
        email: settings.email,
        bankName: settings.bankName,
        bankBranch: settings.bankBranch,
        bankAccountType: settings.bankAccountType,
        bankAccountNumber: settings.bankAccountNumber,
        bankAccountHolder: settings.bankAccountHolder,
        invoiceRegistrationNumber: settings.invoiceRegistrationNumber,
      });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">会計年度</label>
          <select
            value={settings.fiscalYear}
            onChange={(e) => setSettings({ ...settings, fiscalYear: parseInt(e.target.value) })}
            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 7 }, (_, i) => 2024 + i).map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
          <input
            type="text"
            value={settings.userName}
            onChange={(e) => setSettings({ ...settings, userName: e.target.value })}
            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">屋号</label>
          <input
            type="text"
            value={settings.businessName}
            onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">給与収入（年間）</label>
          <input
            type="number" min={0} step={10000}
            value={settings.salaryRevenue}
            onChange={(e) => setSettings({ ...settings, salaryRevenue: parseInt(e.target.value) || 0 })}
            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">アルバイト等の年間給与収入を入力してください</p>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.isStudent}
              onChange={(e) => setSettings({ ...settings, isStudent: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">学生である（勤労学生控除の対象）</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">青色申告特別控除額</label>
          <select
            value={settings.blueReturnLevel}
            onChange={(e) => setSettings({ ...settings, blueReturnLevel: parseInt(e.target.value) as 65 | 55 })}
            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={65}>65万円（e-Tax申告 または 電子帳簿保存）</option>
            <option value={55}>55万円（複式簿記 + 貸借対照表の作成）</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            65万円控除: e-Tax申告または電子帳簿保存が必要<br />
            55万円控除: 複式簿記 + 貸借対照表の作成が必要
          </p>
        </div>
        {/* 書類発行・事業者情報セクション */}
        <div className="border-t border-gray-200 pt-5 mt-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">書類発行・事業者情報</h3>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
              <input
                type="text"
                value={settings.postalCode}
                onChange={(e) => setSettings({ ...settings, postalCode: e.target.value })}
                placeholder="123-4567"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="090-1234-5678"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full max-w-lg border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 振込先情報 */}
        <div className="border-t border-gray-200 pt-5 mt-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">振込先情報（請求書用）</h3>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">銀行名</label>
              <input
                type="text"
                value={settings.bankName}
                onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">支店名</label>
              <input
                type="text"
                value={settings.bankBranch}
                onChange={(e) => setSettings({ ...settings, bankBranch: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">口座種別</label>
              <select
                value={settings.bankAccountType}
                onChange={(e) => setSettings({ ...settings, bankAccountType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="普通">普通</option>
                <option value="当座">当座</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">口座番号</label>
              <input
                type="text"
                value={settings.bankAccountNumber}
                onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">口座名義</label>
            <input
              type="text"
              value={settings.bankAccountHolder}
              onChange={(e) => setSettings({ ...settings, bankAccountHolder: e.target.value })}
              className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* インボイス */}
        <div className="border-t border-gray-200 pt-5 mt-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">インボイス登録番号（任意）</label>
            <input
              type="text"
              value={settings.invoiceRegistrationNumber}
              onChange={(e) => setSettings({ ...settings, invoiceRegistrationNumber: e.target.value })}
              placeholder="T1234567890123"
              className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">適格請求書発行事業者の場合のみ入力してください</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "保存中..." : "設定を保存"}
        </button>
        {saved && <span className="text-green-600 text-sm">保存しました</span>}
      </div>
    </div>
  );
}
