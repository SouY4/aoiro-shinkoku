"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createJournalEntry } from "./journal-actions";

export async function getInventoryItems(fiscalYear: number) {
  return prisma.inventoryItem.findMany({
    where: { fiscalYear },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function getInventoryTotal(fiscalYear: number) {
  const result = await prisma.inventoryItem.aggregate({
    where: { fiscalYear },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function createInventoryItem(data: {
  fiscalYear: number;
  name: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
}) {
  const amount = data.amount ?? Math.round((data.quantity ?? 0) * (data.unitPrice ?? 0));
  const maxOrder = await prisma.inventoryItem.aggregate({
    where: { fiscalYear: data.fiscalYear },
    _max: { sortOrder: true },
  });
  const item = await prisma.inventoryItem.create({
    data: {
      fiscalYear: data.fiscalYear,
      name: data.name,
      quantity: data.quantity ?? 0,
      unitPrice: data.unitPrice ?? 0,
      amount,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/reports/inventory");
  return item;
}

export async function updateInventoryItem(
  id: number,
  data: { name?: string; quantity?: number; unitPrice?: number; amount?: number }
) {
  const current = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!current) return null;
  const amount =
    data.amount ??
    (data.quantity != null || data.unitPrice != null
      ? Math.round((data.quantity ?? current.quantity) * (data.unitPrice ?? current.unitPrice))
      : undefined);
  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name }),
      ...(data.quantity != null && { quantity: data.quantity }),
      ...(data.unitPrice != null && { unitPrice: data.unitPrice }),
      ...(amount != null && { amount: amount }),
    },
  });
  revalidatePath("/reports/inventory");
  return item;
}

export async function deleteInventoryItem(id: number) {
  await prisma.inventoryItem.delete({ where: { id } });
  revalidatePath("/reports/inventory");
}

/** 期末棚卸高の仕訳を作成（借方: 期末商品棚卸高 / 貸方: 仕入高） */
export async function createInventoryJournalEntry(fiscalYear: number, totalAmount: number) {
  if (totalAmount <= 0) throw new Error("棚卸合計が0円です。");
  const accounts = await prisma.account.findMany({
    where: { code: { in: ["5003", "5002"] } },
  });
  const closingInventory = accounts.find((a) => a.code === "5003"); // 期末商品棚卸高
  const purchases = accounts.find((a) => a.code === "5002"); // 仕入高
  if (!closingInventory || !purchases) {
    throw new Error("勘定科目「期末商品棚卸高」(5003) または「仕入高」(5002) が見つかりません。");
  }
  await createJournalEntry({
    date: `${fiscalYear}-12-31`,
    description: `期末棚卸（${fiscalYear}年度）`,
    isAdjusting: true,
    lines: [
      { accountId: closingInventory.id, debitAmount: totalAmount, creditAmount: 0, allocationPercent: 100 },
      { accountId: purchases.id, debitAmount: 0, creditAmount: totalAmount, allocationPercent: 100 },
    ],
  });
  revalidatePath("/reports/inventory");
  revalidatePath("/journal");
  revalidatePath("/ledger");
  revalidatePath("/reports");
}
