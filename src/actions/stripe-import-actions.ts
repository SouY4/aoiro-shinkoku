"use server";

import { prisma } from "@/lib/prisma";
import { createJournalEntry } from "./journal-actions";

const CONFIG_KEY = "stripeImportConfig";

export interface StripeImportConfig {
  debitAccountId: number;        // 借方（既定: 支払手数料 6019）
  creditAccountId: number;       // 貸方（既定: その他の預金 1004）
  creditSubAccountId: number | null; // 貸方補助科目（既定: Stripe残高）
}

/** その月の摘要文字列（重複判定のキーにもなる） */
function feeEntryDescription(year: number, month: number): string {
  return `${year}年${month}月 Stripe決済手数料`;
}

/** 設定を取得。未保存なら勘定科目マスタから既定値を解決する。 */
export async function getStripeImportConfig(): Promise<StripeImportConfig> {
  const setting = await prisma.setting.findUnique({ where: { key: CONFIG_KEY } });
  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value) as StripeImportConfig;
      if (parsed.debitAccountId && parsed.creditAccountId) return parsed;
    } catch {
      // 壊れていれば既定値にフォールバック
    }
  }
  const debit = await prisma.account.findUnique({ where: { code: "6019" } });
  const credit = await prisma.account.findUnique({
    where: { code: "1004" },
    include: { subAccounts: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  const stripeSub = credit?.subAccounts.find((s) => s.name.includes("Stripe")) ?? credit?.subAccounts[0] ?? null;
  return {
    debitAccountId: debit?.id ?? 0,
    creditAccountId: credit?.id ?? 0,
    creditSubAccountId: stripeSub?.id ?? null,
  };
}

export async function saveStripeImportConfig(config: StripeImportConfig): Promise<void> {
  await prisma.setting.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(config) },
    create: { key: CONFIG_KEY, value: JSON.stringify(config) },
  });
}

/** 既に登録済みの月（"YYYY-M" 形式）を返す。重複計上の防止に使う。 */
export async function findExistingFeeMonths(
  months: { year: number; month: number }[]
): Promise<string[]> {
  if (months.length === 0) return [];
  // 摘要 → "YYYY-M" の対応表を作り、1クエリで存在チェックする
  const descToKey = new Map<string, string>();
  for (const { year, month } of months) {
    descToKey.set(feeEntryDescription(year, month), `${year}-${String(month).padStart(2, "0")}`);
  }
  const found = await prisma.journalEntry.findMany({
    where: { description: { in: [...descToKey.keys()] } },
    select: { description: true },
  });
  const keys = new Set<string>();
  for (const e of found) {
    const key = descToKey.get(e.description);
    if (key) keys.add(key);
  }
  return [...keys];
}

export interface ImportResult {
  createdMonths: string[];
  skippedMonths: string[];
}

/**
 * 選択された月ごとに月次手数料仕訳を作成。既存の月はスキップ（上書きしない）。
 * ループ途中で失敗した場合、それ以前に作成した月はコミット済みのまま throw する。
 * 再実行すると作成済みの月はスキップされるため冪等に再試行できる。
 */
export async function importStripeFees(
  selected: { year: number; month: number; total: number }[],
  config: StripeImportConfig
): Promise<ImportResult> {
  if (!config.debitAccountId || !config.creditAccountId) {
    throw new Error("勘定科目が設定されていません。借方・貸方の科目を選択してください（既定の支払手数料 6019・その他の預金 1004 が見つからない可能性があります）。");
  }

  const createdMonths: string[] = [];
  const skippedMonths: string[] = [];

  for (const { year, month, total } of selected) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (total <= 0) {
      skippedMonths.push(key);
      continue;
    }
    const description = feeEntryDescription(year, month);
    const exists = await prisma.journalEntry.findFirst({
      where: { description },
      select: { id: true },
    });
    if (exists) {
      skippedMonths.push(key);
      continue;
    }
    const lastDay = new Date(year, month, 0).getDate();
    const date = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    await createJournalEntry({
      date,
      description,
      lines: [
        { accountId: config.debitAccountId, debitAmount: total, creditAmount: 0 },
        {
          accountId: config.creditAccountId,
          subAccountId: config.creditSubAccountId,
          debitAmount: 0,
          creditAmount: total,
        },
      ],
    });
    createdMonths.push(key);
  }

  return { createdMonths, skippedMonths };
}
