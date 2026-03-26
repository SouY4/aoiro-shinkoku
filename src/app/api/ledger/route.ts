import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountId = parseInt(searchParams.get("accountId") || "0");
  const fiscalYear = parseInt(searchParams.get("fiscalYear") || String(new Date().getFullYear()));

  if (!accountId) return NextResponse.json([]);

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json([]);

  const startDate = new Date(fiscalYear, 0, 1);
  const endDate = new Date(fiscalYear + 1, 0, 1);

  const isDebitNormal = account.type === "asset" || account.type === "expense";

  // 前期繰越残高を計算（資産・負債・資本のストック勘定のみ）
  let carryForwardBalance = 0;
  if (account.type === "asset" || account.type === "liability" || account.type === "capital") {
    const priorLines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: { date: { lt: startDate } },
      },
    });
    for (const line of priorLines) {
      if (isDebitNormal) {
        carryForwardBalance += line.debitAmount - line.creditAmount;
      } else {
        carryForwardBalance += line.creditAmount - line.debitAmount;
      }
    }
  }

  // 当期の仕訳明細を取得
  const lines = await prisma.journalLine.findMany({
    where: {
      accountId,
      journalEntry: { date: { gte: startDate, lt: endDate } },
    },
    include: {
      journalEntry: {
        include: { lines: { include: { account: true } } },
      },
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  let balance = carryForwardBalance;

  const entries = [];

  // 前期繰越行を追加（ストック勘定のみ）
  if (carryForwardBalance !== 0) {
    entries.push({
      date: `${fiscalYear}/01/01`,
      description: "前期繰越",
      counterAccount: "",
      debitAmount: isDebitNormal && carryForwardBalance > 0 ? carryForwardBalance : 0,
      creditAmount: !isDebitNormal && carryForwardBalance > 0 ? carryForwardBalance : 0,
      balance: carryForwardBalance,
      isCarryForward: true,
    });
  }

  for (const line of lines) {
    if (isDebitNormal) {
      balance += line.debitAmount - line.creditAmount;
    } else {
      balance += line.creditAmount - line.debitAmount;
    }

    const counterAccounts = line.journalEntry.lines
      .filter((l) => l.id !== line.id)
      .map((l) => l.account.name);

    entries.push({
      date: line.journalEntry.date.toISOString().split("T")[0].replace(/-/g, "/"),
      description: line.journalEntry.description,
      counterAccount: counterAccounts.join("・"),
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      balance,
      isCarryForward: false,
    });
  }

  return NextResponse.json(entries);
}
