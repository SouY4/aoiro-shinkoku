import type { AccountType, JournalLineInput } from "@/types";

// 仕訳の借方・貸方一致を検証
export function validateJournalEntry(lines: JournalLineInput[]): {
  isValid: boolean;
  totalDebits: number;
  totalCredits: number;
  error?: string;
} {
  const totalDebits = lines.reduce((sum, l) => sum + l.debitAmount, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.creditAmount, 0);

  if (totalDebits === 0 && totalCredits === 0) {
    return { isValid: false, totalDebits, totalCredits, error: "金額を入力してください" };
  }

  if (totalDebits !== totalCredits) {
    return {
      isValid: false,
      totalDebits,
      totalCredits,
      error: `借方合計(${totalDebits.toLocaleString()}円)と貸方合計(${totalCredits.toLocaleString()}円)が一致しません`,
    };
  }

  return { isValid: true, totalDebits, totalCredits };
}

// 勘定科目タイプに基づく残高計算
// 資産・費用: 借方残高 (debits - credits)
// 負債・収益・資本: 貸方残高 (credits - debits)
export function calculateAccountBalance(
  accountType: AccountType,
  totalDebits: number,
  totalCredits: number
): number {
  if (accountType === "asset" || accountType === "expense") {
    return totalDebits - totalCredits;
  }
  return totalCredits - totalDebits;
}

// 勘定科目が借方増加か判定
export function isDebitNormal(accountType: AccountType): boolean {
  return accountType === "asset" || accountType === "expense";
}

// 勘定科目タイプの日本語ラベル
export function getAccountTypeLabel(type: AccountType): string {
  const labels: Record<AccountType, string> = {
    asset: "資産",
    liability: "負債",
    revenue: "収益",
    expense: "費用",
    capital: "資本",
  };
  return labels[type];
}

// 勘定科目カテゴリの日本語ラベル
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    current_asset: "流動資産",
    fixed_asset: "固定資産",
    owner_drawing: "事業主貸",
    contra_asset: "資産控除",
    current_liability: "流動負債",
    capital: "資本金",
    owner_investment: "事業主借",
    sales: "売上",
    other: "その他収入",
    cogs: "売上原価",
    operating: "経費",
  };
  return labels[category] || category;
}
