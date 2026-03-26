"use server";

import { prisma } from "@/lib/prisma";
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
  const endDate = new Date(fiscalYear + 1, 0, 1); // 翌年1月1日未満

  // 期末日以前の全仕訳を取得（ストック勘定は累計）
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { date: { lt: endDate } },
    },
    include: { account: true },
  });

  const assetAccounts = new Map<string, number>();
  const liabilityAccounts = new Map<string, number>();
  const capitalAccounts = new Map<string, number>();

  // 当期の収益・費用を集計して当期純損益を算出
  // ※ 損益計算書と一致させるため、経費(operating)には家事按分を適用
  // ※ 按分の私的利用分は「事業主貸」として資産に加算（複式簿記の均衡を保つ）
  let totalRevenueCredit = 0;
  let totalExpenseDebit = 0;   // 按分適用後の費用合計
  let totalPrivateUse = 0;     // 家事按分で私的利用とした金額の合計

  for (const line of lines) {
    if (line.account.type === "asset") {
      if (line.account.category === "contra_asset") {
        const current = assetAccounts.get(line.account.name) || 0;
        assetAccounts.set(line.account.name, current - (line.creditAmount - line.debitAmount));
      } else {
        const current = assetAccounts.get(line.account.name) || 0;
        assetAccounts.set(line.account.name, current + line.debitAmount - line.creditAmount);
      }
    } else if (line.account.type === "liability") {
      const current = liabilityAccounts.get(line.account.name) || 0;
      liabilityAccounts.set(line.account.name, current + line.creditAmount - line.debitAmount);
    } else if (line.account.type === "capital") {
      const current = capitalAccounts.get(line.account.name) || 0;
      capitalAccounts.set(line.account.name, current + line.creditAmount - line.debitAmount);
    } else if (line.account.type === "revenue") {
      totalRevenueCredit += line.creditAmount - line.debitAmount;
    } else if (line.account.type === "expense") {
      const debitBalance = line.debitAmount - line.creditAmount;
      if (line.account.category === "operating") {
        const ratio = (line.allocationPercent ?? 100) / 100;
        const businessAmount = Math.round(debitBalance * ratio);
        totalExpenseDebit += businessAmount;
        // 私的利用分 = 全額 - 事業分
        totalPrivateUse += debitBalance - businessAmount;
      } else {
        totalExpenseDebit += debitBalance;
      }
    }
  }

  // 家事按分の私的利用分を「事業主貸」に加算
  // 経費全額で支払っているが、事業経費としては按分後の金額のみ計上。
  // 差額は事業主が個人的に消費した＝事業主貸として扱う。
  if (totalPrivateUse !== 0) {
    const existing = assetAccounts.get("事業主貸") || 0;
    assetAccounts.set("事業主貸", existing + totalPrivateUse);
  }

  // 当期純損益 = 収益 - 費用（按分適用後）
  const currentNetIncome = totalRevenueCredit - totalExpenseDebit;
  if (currentNetIncome !== 0) {
    const existing = capitalAccounts.get("当期利益（損失）") || 0;
    capitalAccounts.set("当期利益（損失）", existing + currentNetIncome);
  }

  const assets = Array.from(assetAccounts.entries())
    .filter(([, amount]) => amount !== 0)
    .map(([account, amount]) => ({ account, amount }));
  const liabilities = Array.from(liabilityAccounts.entries())
    .filter(([, amount]) => amount !== 0)
    .map(([account, amount]) => ({ account, amount }));
  const capital = Array.from(capitalAccounts.entries())
    .filter(([, amount]) => amount !== 0)
    .map(([account, amount]) => ({ account, amount }));

  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  const totalCapital = capital.reduce((s, c) => s + c.amount, 0);

  return {
    assets, totalAssets,
    liabilities, totalLiabilities,
    capital, totalCapital,
    totalLiabilitiesAndCapital: totalLiabilities + totalCapital,
  };
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
  return {
    totalRevenue: is.totalRevenue,
    totalExpenses: is.totalCogs + is.totalExpenses,
    operatingIncome: is.operatingIncome,
    netIncome: is.netIncome,
  };
}
