import { formatCurrency, formatDateJa, formatPostalCode, getDocumentTypeLabel } from "@/lib/formatters";
import type { AppSettings } from "@/types";

type DocData = {
  id: number;
  type: string;
  documentNumber: string;
  issueDate: Date;
  dueDate: Date | null;
  subject: string | null;
  notes: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  client: {
    name: string;
    honorific: string;
    postalCode: string | null;
    address: string | null;
  };
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
    sortOrder: number;
  }[];
};

export default function DocumentPreview({ doc, settings }: { doc: DocData; settings: AppSettings }) {
  const typeLabel = getDocumentTypeLabel(doc.type);

  // Check if mixed tax rates
  const taxRates = [...new Set(doc.lines.map((l) => l.taxRate))];
  const hasMixedRates = taxRates.length > 1;

  return (
    <div className="document-preview bg-white border border-gray-300 max-w-[210mm] mx-auto p-10 shadow-sm">
      {/* タイトル */}
      <h1 className="document-title text-2xl font-bold text-center tracking-[0.3em] mb-8 border-b-2 border-gray-800 pb-3">
        {typeLabel}
      </h1>

      {/* 文書番号・発行日 */}
      <div className="flex justify-between text-sm mb-6">
        <span className="text-gray-600">No. {doc.documentNumber}</span>
        <span>発行日: {formatDateJa(doc.issueDate)}</span>
      </div>

      {/* 宛先 と 発行者 */}
      <div className="flex justify-between gap-8 mb-8">
        {/* 宛先 */}
        <div className="flex-1">
          <div className="border-b-2 border-gray-800 pb-2 mb-2">
            <p className="text-lg font-bold">
              {doc.client.name}
              <span className="ml-2 text-base font-normal">{doc.client.honorific}</span>
            </p>
            {doc.client.postalCode && (
              <p className="text-sm text-gray-600">{"\u3012"}{formatPostalCode(doc.client.postalCode)}</p>
            )}
            {doc.client.address && (
              <p className="text-sm text-gray-600">{doc.client.address}</p>
            )}
          </div>
        </div>

        {/* 発行者 */}
        <div className="text-right text-sm">
          {settings.businessName && <p className="font-bold">{settings.businessName}</p>}
          <p className="font-medium">{settings.userName}</p>
          {settings.postalCode && <p className="text-gray-600">{"\u3012"}{formatPostalCode(settings.postalCode)}</p>}
          {settings.address && <p className="text-gray-600">{settings.address}</p>}
          {settings.phone && <p className="text-gray-600">TEL: {settings.phone}</p>}
          {settings.email && <p className="text-gray-600">{settings.email}</p>}
          {settings.invoiceRegistrationNumber && (
            <p className="text-gray-600 mt-1">登録番号: {settings.invoiceRegistrationNumber}</p>
          )}
        </div>
      </div>

      {/* 件名 */}
      {doc.subject && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">件名</p>
          <p className="font-medium">{doc.subject}</p>
        </div>
      )}

      {/* 支払期限（請求書のみ） */}
      {doc.type === "invoice" && doc.dueDate && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">お支払期限: {formatDateJa(doc.dueDate)}</p>
        </div>
      )}

      {/* 合計金額ボックス */}
      <div className="document-total-box border-2 border-gray-800 rounded px-6 py-3 text-center mb-6">
        <span className="text-sm mr-3">合計金額（税込）</span>
        <span className="text-2xl font-bold">{formatCurrency(doc.total)}</span>
      </div>

      {/* 明細テーブル */}
      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-3 py-2 text-left font-medium">品名</th>
            <th className="border border-gray-300 px-3 py-2 text-right font-medium w-16">数量</th>
            <th className="border border-gray-300 px-3 py-2 text-right font-medium w-24">単価</th>
            {hasMixedRates && (
              <th className="border border-gray-300 px-3 py-2 text-center font-medium w-14">税率</th>
            )}
            <th className="border border-gray-300 px-3 py-2 text-right font-medium w-28">金額</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((line, idx) => (
            <tr key={idx}>
              <td className="border border-gray-300 px-3 py-2">
                {line.description}
                {hasMixedRates && line.taxRate === 8 && <span className="ml-1 text-xs">※</span>}
              </td>
              <td className="border border-gray-300 px-3 py-2 text-right">{line.quantity}</td>
              <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(line.unitPrice)}</td>
              {hasMixedRates && (
                <td className="border border-gray-300 px-3 py-2 text-center">{line.taxRate}%</td>
              )}
              <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={hasMixedRates ? 4 : 3} className="border border-gray-300 px-3 py-2 text-right font-medium">小計</td>
            <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(doc.subtotal)}</td>
          </tr>
          {hasMixedRates ? (
            taxRates.sort((a, b) => a - b).map((rate) => {
              const rateLines = doc.lines.filter((l) => l.taxRate === rate);
              const rateSubtotal = rateLines.reduce((s, l) => s + l.amount, 0);
              // インボイス制度準拠: 端数処理は税率ごとに1回
              const rateTax = Math.floor(rateSubtotal * rate / 100);
              return (
                <tr key={rate}>
                  <td colSpan={4} className="border border-gray-300 px-3 py-2 text-right font-medium">
                    消費税（{rate}%対象 {formatCurrency(rateSubtotal)}）
                    {rate === 8 && " ※"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(rateTax)}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={3} className="border border-gray-300 px-3 py-2 text-right font-medium">
                消費税（{doc.taxRate}%）
              </td>
              <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(doc.taxAmount)}</td>
            </tr>
          )}
          <tr className="font-bold">
            <td colSpan={hasMixedRates ? 4 : 3} className="border border-gray-300 px-3 py-2 text-right">合計金額</td>
            <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(doc.total)}</td>
          </tr>
        </tfoot>
      </table>

      {/* 軽減税率の注記 */}
      {hasMixedRates && taxRates.includes(8) && (
        <p className="text-xs text-gray-600 mb-4">※ 軽減税率（8%）対象品目</p>
      )}

      {/* 振込先（請求書のみ） */}
      {doc.type === "invoice" && settings.bankName && (
        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
          <p className="text-sm font-bold mb-2">お振込先</p>
          <p className="text-sm">
            {settings.bankName} {settings.bankBranch} {settings.bankAccountType}
          </p>
          <p className="text-sm">口座番号: {settings.bankAccountNumber}</p>
          <p className="text-sm">口座名義: {settings.bankAccountHolder}</p>
        </div>
      )}

      {/* 備考 */}
      {doc.notes && (
        <div className="mt-4">
          <p className="text-sm font-bold mb-1">備考</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{doc.notes}</p>
        </div>
      )}
    </div>
  );
}
