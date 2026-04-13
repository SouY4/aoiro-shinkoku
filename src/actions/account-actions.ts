"use server";

import { prisma } from "@/lib/prisma";

export async function getAccounts() {
  return prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    include: {
      subAccounts: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export async function getAccountsByType(type: string) {
  return prisma.account.findMany({
    where: { type, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getAccountsGrouped() {
  const accounts = await getAccounts();
  const grouped: Record<string, typeof accounts> = {};
  for (const account of accounts) {
    if (!grouped[account.type]) grouped[account.type] = [];
    grouped[account.type].push(account);
  }
  return grouped;
}

export async function createSubAccount(accountId: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("補助科目名を入力してください");
  const max = await prisma.subAccount.findFirst({
    where: { accountId },
    orderBy: { sortOrder: "desc" },
  });
  return prisma.subAccount.create({
    data: { accountId, name: trimmed, sortOrder: (max?.sortOrder ?? 0) + 1 },
  });
}

export async function updateSubAccount(id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("補助科目名を入力してください");
  return prisma.subAccount.update({ where: { id }, data: { name: trimmed } });
}

export async function deleteSubAccount(id: number) {
  const inUse = await prisma.journalLine.findFirst({ where: { subAccountId: id } });
  if (inUse) {
    await prisma.subAccount.update({ where: { id }, data: { isActive: false } });
    return { softDeleted: true };
  }
  await prisma.subAccount.delete({ where: { id } });
  return { softDeleted: false };
}
