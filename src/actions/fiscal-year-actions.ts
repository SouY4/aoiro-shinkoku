"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createJournalEntry } from "./journal-actions";
import { updateSettings } from "./settings-actions";

/**
 * 年度繰越処理
 * 1. 事業主借を元入金へ振替（残高がある場合）
 * 2. 事業主貸を元入金から控除（残高がある場合）
 * 3. 翌年度の会計年度設定に更新
 */
export async function performYearEndCarryover(fiscalYear: number): Promise<{
  newFiscalYear: number;
  jigyonushiKariBalance: number;
  jigyonushiKashiBalance: number;
  entriesCreated: number;
}> {
  // --- 残高計算 ---
  const endDate = new Date(fiscalYear + 1, 0, 1);

  const allLines = await prisma.journalLine.findMany({
    where: { journalEntry: { date: { lt: endDate } } },
    include: { account: true },
  });

  // 事業主借 (code "3001", type "capital"): 貸方残高
  let jigyonushiKariBalance = 0;
  // 事業主貸 (code "1090", type "asset"): 借方残高
  let jigyonushiKashiBalance = 0;

  for (const line of allLines) {
    if (line.account.code === "3001") {
      jigyonushiKariBalance += line.creditAmount - line.debitAmount;
    } else if (line.account.code === "1090") {
      jigyonushiKashiBalance += line.debitAmount - line.creditAmount;
    }
  }

  // --- 繰越仕訳の作成（翌年1月1日） ---
  const nextYear = fiscalYear + 1;
  const carryoverDate = `${nextYear}-01-01`;
  let entriesCreated = 0;

  const kariAccount = await prisma.account.findUnique({ where: { code: "3001" } });
  const kashiAccount = await prisma.account.findUnique({ where: { code: "1090" } });
  const motoireAccount = await prisma.account.findUnique({ where: { code: "3002" } });

  if (!kariAccount || !kashiAccount || !motoireAccount) {
    throw new Error("繰越に必要な勘定科目（事業主借・事業主貸・元入金）が見つかりません");
  }

  // 事業主借 → 元入金
  if (jigyonushiKariBalance > 0) {
    await createJournalEntry({
      date: carryoverDate,
      description: `${fiscalYear}年度繰越 — 事業主借を元入金へ振替`,
      isAdjusting: true,
      lines: [
        { accountId: kariAccount.id, debitAmount: jigyonushiKariBalance, creditAmount: 0, description: "年度繰越" },
        { accountId: motoireAccount.id, debitAmount: 0, creditAmount: jigyonushiKariBalance, description: "年度繰越" },
      ],
    });
    entriesCreated++;
  }

  // 元入金 → 事業主貸
  if (jigyonushiKashiBalance > 0) {
    await createJournalEntry({
      date: carryoverDate,
      description: `${fiscalYear}年度繰越 — 事業主貸を元入金から控除`,
      isAdjusting: true,
      lines: [
        { accountId: motoireAccount.id, debitAmount: jigyonushiKashiBalance, creditAmount: 0, description: "年度繰越" },
        { accountId: kashiAccount.id, debitAmount: 0, creditAmount: jigyonushiKashiBalance, description: "年度繰越" },
      ],
    });
    entriesCreated++;
  }

  // 会計年度を翌年に更新
  await updateSettings({ fiscalYear: String(nextYear) });

  revalidatePath("/");
  revalidatePath("/reports");

  return {
    newFiscalYear: nextYear,
    jigyonushiKariBalance,
    jigyonushiKashiBalance,
    entriesCreated,
  };
}

export async function getCarryoverPreview(fiscalYear: number) {
  const endDate = new Date(fiscalYear + 1, 0, 1);

  const allLines = await prisma.journalLine.findMany({
    where: { journalEntry: { date: { lt: endDate } } },
    include: { account: true },
  });

  let jigyonushiKariBalance = 0;
  let jigyonushiKashiBalance = 0;

  for (const line of allLines) {
    if (line.account.code === "3001") {
      jigyonushiKariBalance += line.creditAmount - line.debitAmount;
    } else if (line.account.code === "1090") {
      jigyonushiKashiBalance += line.debitAmount - line.creditAmount;
    }
  }

  // 当期純利益を P/L から計算（当年度のみ）
  const startDate = new Date(fiscalYear, 0, 1);
  const yearLinesWithDate = await prisma.journalLine.findMany({
    where: { journalEntry: { date: { gte: startDate, lt: endDate } } },
    include: { account: true, journalEntry: { select: { date: true } } },
  });

  let totalRevenue = 0;
  let totalExpense = 0;
  for (const line of yearLinesWithDate) {
    if (line.account.type === "revenue") {
      totalRevenue += line.creditAmount - line.debitAmount;
    } else if (line.account.type === "expense") {
      const ratio = (line.allocationPercent ?? 100) / 100;
      totalExpense += Math.round((line.debitAmount - line.creditAmount) * ratio);
    }
  }
  const netIncome = totalRevenue - totalExpense;

  // 元入金残高（期末）
  let motoireBalance = 0;
  for (const line of allLines) {
    if (line.account.code === "3002") {
      motoireBalance += line.creditAmount - line.debitAmount;
    }
  }

  const newMotoire = motoireBalance + jigyonushiKariBalance - jigyonushiKashiBalance + netIncome;

  return {
    jigyonushiKariBalance,
    jigyonushiKashiBalance,
    netIncome,
    motoireBalance,
    newMotoire,
  };
}
