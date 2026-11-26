"use server";

import { getDepreciationForYear } from "@/actions/fixed-asset-actions";
import { getIncomeStatement } from "@/actions/report-actions";
import { getSettings } from "@/actions/settings-actions";
import { prisma } from "@/lib/prisma";
import { buildTaxReturn } from "@/lib/tax-return";
import type { TaxLine, TaxReturnData } from "@/lib/tax-return";

export async function getTaxReturnData(fiscalYear: number): Promise<TaxReturnData> {
  const startDate = new Date(fiscalYear, 0, 1);
  const endDate = new Date(fiscalYear + 1, 0, 1);
  const carryoverPrefix = `${fiscalYear - 1}年度繰越 — `;
  const [journalLines, ledger, depreciationRows, settings] = await Promise.all([
    prisma.journalLine.findMany({
      where: { journalEntry: { date: { lt: endDate } } },
      include: {
        account: true,
        journalEntry: { select: { date: true, description: true, isAdjusting: true } },
      },
    }),
    getIncomeStatement(fiscalYear),
    getDepreciationForYear(fiscalYear),
    getSettings(),
  ]);

  const lines = journalLines.map((line): TaxLine => {
    const { date, description, isAdjusting } = line.journalEntry;
    const before = date < startDate;
    return {
      period: before ? "before" : "current",
      month: before ? 0 : new Date(date).getMonth() + 1,
      isCarryover: isAdjusting && description.startsWith(carryoverPrefix),
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type,
      accountCategory: line.account.category,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      allocationPercent: line.allocationPercent ?? 100,
    };
  });

  const depreciation = depreciationRows.map((row) => {
    const acquisitionDate = new Date(row.acquisitionDate);
    return {
      name: row.name,
      acquisitionYearMonth: `${acquisitionDate.getFullYear()}年${acquisitionDate.getMonth() + 1}月`,
      cost: row.cost,
      usefulLifeYears: row.usefulLifeYears,
      rateMilli: row.rateMilli,
      months: row.months,
      yearAmount: row.yearAmount,
      endBookValue: row.endBookValue,
      alreadyRecorded: row.alreadyRecorded,
    };
  });

  return buildTaxReturn({ fiscalYear, lines, ledger, depreciation, blueReturnLevel: settings.blueReturnLevel });
}
