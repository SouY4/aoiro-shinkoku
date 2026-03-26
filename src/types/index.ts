// 勘定科目タイプ
export type AccountType = "asset" | "liability" | "revenue" | "expense" | "capital";

export type AccountCategory =
  | "current_asset" | "fixed_asset" | "owner_drawing" | "contra_asset"
  | "current_liability"
  | "capital" | "owner_investment"
  | "sales" | "other"
  | "cogs" | "operating";

// 仕訳入力
export interface JournalEntryInput {
  date: string;
  description: string;
  isAdjusting?: boolean;
  lines: JournalLineInput[];
}

export interface JournalLineInput {
  accountId: number;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  /** 家事按分: 事業割合 1–100（100=全額事業、未指定時は100） */
  allocationPercent?: number;
}

// しきい値結果
export interface ThresholdResult {
  name: string;
  nameJa: string;
  threshold: number;
  currentAmount: number;
  remaining: number;
  percentage: number;
  isExceeded: boolean;
  description: string;
  basis: string;
}

// 税額計算
export interface TaxCalculation {
  salaryRevenue: number;
  salaryIncomeDeduction: number;
  salaryIncome: number;
  businessRevenue: number;
  businessExpenses: number;
  blueReturnDeduction: number;
  businessIncome: number;
  totalIncome: number;
  basicDeduction: number;
  workingStudentDeduction: number;
  totalDeductions: number;
  taxableIncome: number;
  incomeTax: number;
  reconstructionTax: number;
  totalTax: number;
}

// 損益計算書
export interface IncomeStatementData {
  revenue: { account: string; amount: number }[];
  totalRevenue: number;
  cogs: { account: string; amount: number }[];
  totalCogs: number;
  grossProfit: number;
  expenses: { account: string; amount: number }[];
  totalExpenses: number;
  operatingIncome: number;
  blueReturnDeduction: number;
  netIncome: number;
}

// 貸借対照表
export interface BalanceSheetData {
  assets: { account: string; amount: number }[];
  totalAssets: number;
  liabilities: { account: string; amount: number }[];
  totalLiabilities: number;
  capital: { account: string; amount: number }[];
  totalCapital: number;
  totalLiabilitiesAndCapital: number;
}

// 仕訳テンプレート
export interface JournalTemplate {
  name: string;
  description: string;
  lines: { accountCode: string; isDebit: boolean }[];
}

// 設定
export interface AppSettings {
  fiscalYear: number;
  userName: string;
  businessName: string;
  salaryRevenue: number;
  isStudent: boolean;
  blueReturnLevel: 65 | 55;
  // 書類発行用の事業者情報
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
}

// 書類タイプ
export type DocumentType = "invoice" | "quotation" | "delivery";

// 書類ステータス
export type DocumentStatus = "draft" | "sent" | "paid" | "cancelled";

// 書類明細入力
export interface DocumentLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

// 書類作成入力
export interface DocumentInput {
  type: DocumentType;
  clientId: number;
  issueDate: string;
  dueDate?: string;
  subject?: string;
  notes?: string;
  taxRate?: number;
  lines: DocumentLineInput[];
  sourceDocumentId?: number;
}

// 取引先入力
export interface ClientInput {
  name: string;
  honorific?: string;
  contactPerson?: string;
  postalCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  memo?: string;
}
