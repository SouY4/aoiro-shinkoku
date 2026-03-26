"use server";

import { prisma } from "@/lib/prisma";

export async function getAccounts() {
  return prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
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
