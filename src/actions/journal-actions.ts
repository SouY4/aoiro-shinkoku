"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function clampAllocationPercent(v: number | undefined): number {
  if (v == null || Number.isNaN(v)) return 100;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function validateLines(lines: { accountId: number; debitAmount: number; creditAmount: number }[]) {
  if (lines.length < 2) {
    throw new Error("最低2行の仕訳明細が必要です");
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.accountId || line.accountId <= 0) {
      throw new Error(`行${i + 1}: 勘定科目を選択してください`);
    }
    if (line.debitAmount < 0 || line.creditAmount < 0) {
      throw new Error(`行${i + 1}: 金額は0以上で入力してください`);
    }
    if (line.debitAmount > 0 && line.creditAmount > 0) {
      throw new Error(`行${i + 1}: 借方または貸方のどちらか一方に金額を入力してください`);
    }
    if (line.debitAmount === 0 && line.creditAmount === 0) {
      throw new Error(`行${i + 1}: 金額を入力してください`);
    }
  }
  const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
  const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
  if (totalDebit !== totalCredit) {
    throw new Error(`借方合計(${totalDebit.toLocaleString()}円)と貸方合計(${totalCredit.toLocaleString()}円)が一致しません`);
  }
}

async function writeAuditLog(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  journalEntryId: number,
  action: "create" | "update" | "delete",
  beforeData: object | null,
  afterData: object | null
) {
  await tx.journalAuditLog.create({
    data: {
      journalEntryId,
      action,
      beforeData: beforeData ? JSON.stringify(beforeData) : null,
      afterData: afterData ? JSON.stringify(afterData) : null,
    },
  });
}

export async function createJournalEntry(data: {
  date: string;
  description: string;
  transactionDate?: string | null;
  paymentDate?: string | null;
  isAdjusting?: boolean;
  clientId?: number | null;
  lines: { accountId: number; debitAmount: number; creditAmount: number; description?: string; allocationPercent?: number }[];
}) {
  // サーバー側バリデーション
  if (!data.date) throw new Error("日付を入力してください");
  if (!data.description?.trim()) throw new Error("摘要を入力してください");
  validateLines(data.lines);

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.journalEntry.create({
      data: {
        date: new Date(data.date),
        transactionDate: data.transactionDate ? new Date(data.transactionDate) : null,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        description: data.description.trim(),
        isAdjusting: data.isAdjusting || false,
        clientId: data.clientId || null,
        lines: {
          create: data.lines.map((line) => ({
            accountId: line.accountId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description || null,
            allocationPercent: clampAllocationPercent(line.allocationPercent),
          })),
        },
      },
      include: { lines: { include: { account: true } }, client: true },
    });
    await writeAuditLog(tx, created.id, "create", null, { description: created.description, date: created.date, lines: data.lines });
    return created;
  });

  revalidatePath("/journal");
  revalidatePath("/ledger");
  revalidatePath("/reports");
  revalidatePath("/");
  return entry;
}

export async function updateJournalEntry(
  id: number,
  data: {
    date: string;
    description: string;
    transactionDate?: string | null;
    paymentDate?: string | null;
    isAdjusting?: boolean;
    clientId?: number | null;
    lines: { accountId: number; debitAmount: number; creditAmount: number; description?: string; allocationPercent?: number }[];
  }
) {
  // サーバー側バリデーション
  if (!data.date) throw new Error("日付を入力してください");
  if (!data.description?.trim()) throw new Error("摘要を入力してください");
  validateLines(data.lines);

  // 既存の仕訳明細を全削除して新規作成（トランザクション内）
  const entry = await prisma.$transaction(async (tx) => {
    // 変更前データを記録
    const before = await tx.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    // 旧明細を削除
    await tx.journalLine.deleteMany({ where: { journalEntryId: id } });

    // 仕訳ヘッダを更新＋新明細を作成
    const updated = await tx.journalEntry.update({
      where: { id },
      data: {
        date: new Date(data.date),
        transactionDate: data.transactionDate ? new Date(data.transactionDate) : null,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        description: data.description.trim(),
        isAdjusting: data.isAdjusting || false,
        clientId: data.clientId || null,
        lines: {
          create: data.lines.map((line) => ({
            accountId: line.accountId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description || null,
            allocationPercent: clampAllocationPercent(line.allocationPercent),
          })),
        },
      },
      include: { lines: { include: { account: true } }, client: true },
    });

    await writeAuditLog(tx, id, "update",
      before ? { description: before.description, date: before.date, lines: before.lines } : null,
      { description: updated.description, date: updated.date, lines: data.lines }
    );
    return updated;
  });

  revalidatePath("/journal");
  revalidatePath("/ledger");
  revalidatePath("/reports");
  revalidatePath("/");
  return entry;
}

export async function getJournalEntry(id: number) {
  return prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: { include: { account: true } }, receipts: true, client: true },
  });
}

export async function getJournalEntries(fiscalYear: number) {
  const startDate = new Date(fiscalYear, 0, 1);
  const endDate = new Date(fiscalYear + 1, 0, 1);
  return prisma.journalEntry.findMany({
    where: { date: { gte: startDate, lt: endDate } },
    include: { lines: { include: { account: true } }, receipts: true, client: true },
    orderBy: { date: "asc" },
  });
}

export async function deleteJournalEntry(id: number) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    await tx.journalEntry.delete({ where: { id } });
    await writeAuditLog(tx, id, "delete",
      before ? { description: before.description, date: before.date, lines: before.lines } : null,
      null
    );
  });
  revalidatePath("/journal");
  revalidatePath("/ledger");
  revalidatePath("/reports");
  revalidatePath("/");
}

export async function getRecentEntries(limit: number = 5) {
  return prisma.journalEntry.findMany({
    include: { lines: { include: { account: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** 訂正仕訳を自動作成（元の仕訳と逆の仕訳を作成） */
export async function createReversalEntry(originalId: number) {
  const original = await prisma.journalEntry.findUnique({
    where: { id: originalId },
    include: { lines: true },
  });
  if (!original) throw new Error("元の仕訳が見つかりません");

  const today = new Date().toISOString().split("T")[0];

  const entry = await prisma.journalEntry.create({
    data: {
      date: new Date(today),
      description: `【訂正】${original.description}`,
      isAdjusting: true,
      lines: {
        create: original.lines.map((line) => ({
          accountId: line.accountId,
          // 借方と貸方を逆にする
          debitAmount: line.creditAmount,
          creditAmount: line.debitAmount,
          description: `訂正: ${line.description || ""}`.trim(),
          allocationPercent: line.allocationPercent,
        })),
      },
    },
    include: { lines: { include: { account: true } } },
  });

  revalidatePath("/journal");
  revalidatePath("/ledger");
  revalidatePath("/reports");
  revalidatePath("/");
  return entry;
}
