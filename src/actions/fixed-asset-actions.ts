"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { straightLineDepreciation } from "@/lib/depreciation";
import { createJournalEntry } from "./journal-actions";

export async function getFixedAssets() {
  return prisma.fixedAsset.findMany({
    include: {
      assetAccount: true,
      expenseAccount: true,
      depreciationRecords: true,
    },
    orderBy: { acquisitionDate: "desc" },
  });
}

export async function createFixedAsset(data: {
  name: string;
  acquisitionDate: string;
  cost: number;
  usefulLifeYears: number;
  assetAccountId: number;
  expenseAccountId: number;
  memo?: string;
}) {
  const asset = await prisma.fixedAsset.create({
    data: {
      name: data.name,
      acquisitionDate: new Date(data.acquisitionDate),
      cost: data.cost,
      usefulLifeYears: data.usefulLifeYears,
      depreciationMethod: "straight_line",
      assetAccountId: data.assetAccountId,
      expenseAccountId: data.expenseAccountId,
      memo: data.memo ?? null,
    },
    include: { assetAccount: true, expenseAccount: true },
  });
  revalidatePath("/reports/fixed-assets");
  return asset;
}

export async function updateFixedAsset(
  id: number,
  data: {
    name?: string;
    acquisitionDate?: string;
    cost?: number;
    usefulLifeYears?: number;
    assetAccountId?: number;
    expenseAccountId?: number;
    memo?: string;
  }
) {
  const asset = await prisma.fixedAsset.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name }),
      ...(data.acquisitionDate != null && { acquisitionDate: new Date(data.acquisitionDate) }),
      ...(data.cost != null && { cost: data.cost }),
      ...(data.usefulLifeYears != null && { usefulLifeYears: data.usefulLifeYears }),
      ...(data.assetAccountId != null && { assetAccountId: data.assetAccountId }),
      ...(data.expenseAccountId != null && { expenseAccountId: data.expenseAccountId }),
      ...(data.memo !== undefined && { memo: data.memo ?? null }),
    },
    include: { assetAccount: true, expenseAccount: true, depreciationRecords: true },
  });
  revalidatePath("/reports/fixed-assets");
  return asset;
}

export async function deleteFixedAsset(id: number) {
  await prisma.fixedAsset.delete({ where: { id } });
  revalidatePath("/reports/fixed-assets");
}

/** 指定年度の各固定資産の償却額を計算（既に記録がある場合はその額を返す） */
export async function getDepreciationForYear(fiscalYear: number) {
  const assets = await prisma.fixedAsset.findMany({
    include: {
      assetAccount: true,
      expenseAccount: true,
      depreciationRecords: { where: { fiscalYear } },
    },
  });

  const yearStart = new Date(fiscalYear, 0, 1);
  const results: {
    assetId: number;
    name: string;
    acquisitionDate: Date;
    cost: number;
    usefulLifeYears: number;
    depreciationMethod: string;
    accumulatedAmount: number;
    bookValue: number;
    yearAmount: number;
    endBookValue: number;
    alreadyRecorded: boolean;
    assetAccountName: string;
    expenseAccountName: string;
  }[] = [];

  for (const asset of assets) {
    const existing = asset.depreciationRecords[0];
    const accumulated = await prisma.depreciationRecord.aggregate({
      where: { fixedAssetId: asset.id, fiscalYear: { not: fiscalYear } },
      _sum: { amount: true },
    });
    const accumulatedAmount = accumulated._sum.amount ?? 0;
    const bookValue = asset.cost - accumulatedAmount;

    let yearAmount: number;
    if (existing) {
      yearAmount = existing.amount;
    } else {
      yearAmount =
        asset.depreciationMethod === "straight_line"
          ? straightLineDepreciation({
              cost: asset.cost,
              usefulLifeYears: asset.usefulLifeYears,
              accumulatedAmount,
              fiscalYearStart: yearStart,
              acquisitionDate: asset.acquisitionDate,
            })
          : 0;
    }

    results.push({
      assetId: asset.id,
      name: asset.name,
      acquisitionDate: asset.acquisitionDate,
      cost: asset.cost,
      usefulLifeYears: asset.usefulLifeYears,
      depreciationMethod: asset.depreciationMethod,
      accumulatedAmount,
      bookValue,
      yearAmount,
      endBookValue: Math.max(1, bookValue - yearAmount),
      alreadyRecorded: !!existing,
      assetAccountName: asset.assetAccount.name,
      expenseAccountName: asset.expenseAccount.name,
    });
  }

  return results;
}

/** 指定年度の減価償却仕訳を一括作成（12/31で仕訳、借方: 減価償却費 / 貸方: 固定資産） */
export async function createDepreciationJournalEntry(fiscalYear: number) {
  const items = await getDepreciationForYear(fiscalYear);
  const toRecord = items.filter((i) => i.yearAmount > 0 && !i.alreadyRecorded);
  if (toRecord.length === 0) {
    throw new Error("償却する資産がありません。既に仕訳済みの場合は重複実行できません。");
  }

  const expenseByAccount = new Map<number, number>();
  const assetByAccount = new Map<number, number>();
  for (const r of toRecord) {
    const asset = await prisma.fixedAsset.findUnique({
      where: { id: r.assetId },
      select: { assetAccountId: true, expenseAccountId: true },
    });
    if (!asset) continue;
    expenseByAccount.set(
      asset.expenseAccountId,
      (expenseByAccount.get(asset.expenseAccountId) ?? 0) + r.yearAmount
    );
    assetByAccount.set(
      asset.assetAccountId,
      (assetByAccount.get(asset.assetAccountId) ?? 0) + r.yearAmount
    );
  }

  // 仕訳: 借方 減価償却費 合計 / 貸方 各固定資産勘定
  const lines: { accountId: number; debitAmount: number; creditAmount: number; allocationPercent: number }[] = [];
  let totalDebit = 0;
  for (const [accountId, amount] of expenseByAccount) {
    lines.push({ accountId, debitAmount: amount, creditAmount: 0, allocationPercent: 100 });
    totalDebit += amount;
  }
  let totalCredit = 0;
  for (const [accountId, amount] of assetByAccount) {
    lines.push({ accountId, debitAmount: 0, creditAmount: amount, allocationPercent: 100 });
    totalCredit += amount;
  }
  if (totalDebit !== totalCredit) {
    throw new Error("借方と貸方の合計が一致しません");
  }

  const entry = await createJournalEntry({
    date: `${fiscalYear}-12-31`,
    description: `減価償却（${fiscalYear}年度）`,
    isAdjusting: true,
    lines,
  });

  // DepreciationRecord を保存（仕訳と紐付け）
  const entryId = entry.id;
  for (const r of toRecord) {
    const asset = await prisma.fixedAsset.findUnique({
      where: { id: r.assetId },
      select: { assetAccountId: true, expenseAccountId: true },
    });
    if (!asset) continue;
    await prisma.depreciationRecord.upsert({
      where: {
        fixedAssetId_fiscalYear: { fixedAssetId: r.assetId, fiscalYear },
      },
      create: {
        fixedAssetId: r.assetId,
        fiscalYear,
        amount: r.yearAmount,
        journalEntryId: entryId,
      },
      update: { amount: r.yearAmount, journalEntryId: entryId },
    });
  }

  revalidatePath("/reports/fixed-assets");
  revalidatePath("/journal");
  revalidatePath("/ledger");
  revalidatePath("/reports");
  return entry;
}
