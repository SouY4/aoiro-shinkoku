"use server";

import { prisma } from "@/lib/prisma";
import { buildBalanceSheet, type BalanceLine } from "@/lib/balance-sheet";
import type { IncomeStatementData, BalanceSheetData } from "@/types";

export async function getIncomeStatement(fiscalYear: number): Promise<IncomeStatementData> {
  const startDate = new Date(fiscalYear, 0, 1);
  const endDate = new Date(fiscalYear + 1, 0, 1); // 翌年1月1日未満

  // 全仕訳明細を取得
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { date: { gte: startDate, lt: endDate } },
    },
    include: { account: true },
  });

  // 収益集計（家事按分は適用しない）
  const revenueAccounts = new Map<string, number>();
  // 売上原価集計
  const cogsAccounts = new Map<string, number>();
  // 経費集計（家事按分を適用）
  const expenseAccounts = new Map<string, number>();

  for (const line of lines) {
    if (line.account.type === "revenue") {
      // 収益: 貸方残高 (credit - debit)。家事按分は適用しない
      const balance = line.creditAmount - line.debitAmount;
      const current = revenueAccounts.get(line.account.name) || 0;
      revenueAccounts.set(line.account.name, current + balance);
    } else if (line.account.type === "expense" && line.account.category === "cogs") {
      // 売上原価: 借方残高 (debit - credit)
      // 期末商品棚卸高は通常 貸方に記帳されるので debitBalance がマイナスになる → 控除として正しく機能
      // 家事按分は売上原価には通常適用しない
      const debitBalance = line.debitAmount - line.creditAmount;
      const current = cogsAccounts.get(line.account.name) || 0;
      cogsAccounts.set(line.account.name, current + debitBalance);
    } else if (line.account.type === "expense" && line.account.category === "operating") {
      // 経費: 借方残高に家事按分を適用
      const ratio = (line.allocationPercent ?? 100) / 100;
      const debitBalance = line.debitAmount - line.creditAmount;
      const current = expenseAccounts.get(line.account.name) || 0;
      expenseAccounts.set(line.account.name, current + Math.round(debitBalance * ratio));
    }
  }

  // 損益計算書 - 売上原価セクション（青色申告決算書フォーマット）
  // 期首商品棚卸高 + 仕入高 を正の値、期末商品棚卸高を負の値として表示
  const cogsEntries = Array.from(cogsAccounts.entries());
  const cogs = cogsEntries.map(([account, amount]) => ({ account, amount }));

  const revenue = Array.from(revenueAccounts.entries()).map(([account, amount]) => ({ account, amount }));
  const expenses = Array.from(expenseAccounts.entries()).map(([account, amount]) => ({ account, amount }));

  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  // 売上原価合計 = 期首棚卸高 + 仕入高 - 期末棚卸高（期末棚卸高は負値なので自動的に引かれる）
  const totalCogs = cogs.reduce((s, c) => s + c.amount, 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const operatingIncome = grossProfit - totalExpenses;

  // 青色申告特別控除
  const blueReturnSetting = await prisma.setting.findUnique({ where: { key: "blueReturnLevel" } });
  const blueLevel = parseInt(blueReturnSetting?.value || "65");
  const blueReturnDeduction = Math.min(blueLevel * 10_000, Math.max(0, operatingIncome));
  const netIncome = operatingIncome - blueReturnDeduction;

  return {
    revenue, totalRevenue,
    cogs, totalCogs,
    grossProfit,
    expenses, totalExpenses,
    operatingIncome,
    blueReturnDeduction,
    netIncome,
  };
}

export async function getBalanceSheet(fiscalYear: number): Promise<BalanceSheetData> {
  const startDate = new Date(fiscalYear, 0, 1);
  const endDate = new Date(fiscalYear + 1, 0, 1);
  const carryoverPrefix = `${fiscalYear - 1}年度繰越 — `;
  const journalLines = await prisma.journalLine.findMany({
    where: { journalEntry: { date: { lt: endDate } } },
    include: {
      account: true,
      journalEntry: { select: { date: true, description: true, isAdjusting: true } },
    },
  });

  const lines = journalLines.map((line): BalanceLine => {
    const { date, description, isAdjusting } = line.journalEntry;
    const before = date < startDate;
    return {
      period: before ? "before" : "current",
      isCarryover: !before && isAdjusting && description.startsWith(carryoverPrefix),
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type,
      accountCategory: line.account.category,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      allocationPercent: line.allocationPercent ?? 100,
    };
  });

  return buildBalanceSheet(lines);
}

export async function getMonthlySales(fiscalYear: number) {
  const startDate = new Date(fiscalYear, 0, 1);
  const endDate = new Date(fiscalYear + 1, 0, 1);

  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { date: { gte: startDate, lt: endDate } },
      account: { type: { in: ["revenue", "expense"] } },
    },
    include: {
      account: true,
      journalEntry: { select: { date: true } },
    },
  });

  const monthlyRevenue = new Array(12).fill(0);
  const monthlyCogs = new Array(12).fill(0);
  let hasCogs = false;

  for (const line of lines) {
    const month = new Date(line.journalEntry.date).getMonth(); // 0-indexed
    if (line.account.type === "revenue") {
      monthlyRevenue[month] += line.creditAmount - line.debitAmount;
    } else if (line.account.type === "expense" && line.account.category === "cogs") {
      monthlyCogs[month] += line.debitAmount - line.creditAmount;
      hasCogs = true;
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue: monthlyRevenue[i],
    cogs: monthlyCogs[i],
  }));

  return {
    months,
    totalRevenue: monthlyRevenue.reduce((s, v) => s + v, 0),
    totalCogs: monthlyCogs.reduce((s, v) => s + v, 0),
    hasCogs,
  };
}

export async function getBusinessSummary(fiscalYear: number) {
  const is = await getIncomeStatement(fiscalYear);

  // 按分経費（allocationPercent < 100 の operating 経費の事業按分後合計）を別途集計
  const startDate = new Date(fiscalYear, 0, 1);
  const endDate = new Date(fiscalYear + 1, 0, 1);
  const proportionalLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { date: { gte: startDate, lt: endDate } },
      account: { type: "expense", category: "operating" },
      allocationPercent: { lt: 100 },
    },
    select: { debitAmount: true, creditAmount: true, allocationPercent: true },
  });
  const totalProportionalExpenses = proportionalLines.reduce((sum, line) => {
    const ratio = (line.allocationPercent ?? 100) / 100;
    return sum + Math.round((line.debitAmount - line.creditAmount) * ratio);
  }, 0);

  return {
    totalRevenue: is.totalRevenue,
    totalExpenses: is.totalCogs + is.totalExpenses,
    totalProportionalExpenses,
    operatingIncome: is.operatingIncome,
    netIncome: is.netIncome,
  };
}
