// 通貨フォーマット（円）
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    minimumFractionDigits: 0,
  }).format(amount);
}

// 数値フォーマット（カンマ区切り）
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("ja-JP").format(amount);
}

// 日付フォーマット（和暦）- UTCベースでタイムゾーンずれを防止
export function formatDateJa(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}年${m}月${day}日`;
}

// 日付フォーマット（短縮）- UTCベースでタイムゾーンずれを防止
export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

// 令和年を計算
export function toReiwa(year: number): string {
  const reiwaYear = year - 2018;
  if (reiwaYear === 1) return "令和元年";
  return `令和${reiwaYear}年`;
}

// 勘定科目タイプの日本語ラベル
export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    asset: "資産",
    liability: "負債",
    revenue: "収益",
    expense: "費用",
    capital: "資本",
  };
  return labels[type] || type;
}

// 書類種別の日本語ラベル
export function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    invoice: "請求書",
    quotation: "見積書",
    delivery: "納品書",
  };
  return labels[type] || type;
}

// 書類ステータスの日本語ラベル
export function getDocumentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "下書き",
    sent: "送付済み",
    paid: "入金済み",
    cancelled: "取消",
  };
  return labels[status] || status;
}

// 郵便番号フォーマット: 1234567 -> 123-4567
export function formatPostalCode(code: string): string {
  const digits = code.replace(/[^0-9]/g, "");
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return code;
}
