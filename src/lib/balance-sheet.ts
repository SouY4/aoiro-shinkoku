import type { BalanceSheetData } from "@/types";

export type BalanceLine = {
  period: "before" | "current";
  isCarryover: boolean;
  accountCode: string;
  accountName: string;
  accountType: string;
  accountCategory: string;
  debitAmount: number;
  creditAmount: number;
  allocationPercent: number;
};

function balanceRows(balances: Map<string, number>) {
  return Array.from(balances, ([account, amount]) => ({ account, amount }))
    .filter(({ amount }) => amount !== 0);
}

export function buildBalanceSheet(lines: BalanceLine[]): BalanceSheetData {
  const assetAccounts = new Map<string, number>();
  const liabilityAccounts = new Map<string, number>();
  let openingCapital = 0;
  let capitalChange = 0;
  let ownerDrawing = 0;
  let ownerContribution = 0;
  let currentNetIncome = 0;

  for (const line of lines) {
    const { accountCode, accountName, accountType, accountCategory } = line;
    const debitBalance = line.debitAmount - line.creditAmount;
    const before = line.period === "before";

    if (accountType === "asset" && accountCode !== "1090") {
      assetAccounts.set(accountName, (assetAccounts.get(accountName) ?? 0) + debitBalance);
      if (before) openingCapital += debitBalance;
    } else if (accountType === "liability") {
      liabilityAccounts.set(accountName, (liabilityAccounts.get(accountName) ?? 0) - debitBalance);
      if (before) openingCapital += debitBalance;
    }

    if (before) continue;

    if (!line.isCarryover) {
      if (accountCode === "1090") ownerDrawing += debitBalance;
      else if (accountCode === "3001") ownerContribution -= debitBalance;
      else if (accountType === "capital") capitalChange -= debitBalance;
    }

    if (accountType === "revenue") {
      currentNetIncome -= debitBalance;
    } else if (accountType === "expense") {
      if (accountCategory === "operating") {
        const ratio = (line.allocationPercent ?? 100) / 100;
        const businessAmount = Math.round(debitBalance * ratio);
        currentNetIncome -= businessAmount;
        ownerDrawing += debitBalance - businessAmount;
      } else {
        currentNetIncome -= debitBalance;
      }
    }
  }

  assetAccounts.set("事業主貸", (assetAccounts.get("事業主貸") ?? 0) + ownerDrawing);
  const assets = balanceRows(assetAccounts);
  const liabilities = balanceRows(liabilityAccounts);
  const capital = [
    { account: "事業主借", amount: ownerContribution },
    { account: "元入金", amount: openingCapital + capitalChange },
    { account: "当期利益（損失）", amount: currentNetIncome },
  ].filter(({ amount }) => amount !== 0);

  const totalAssets = assets.reduce((sum, row) => sum + row.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, row) => sum + row.amount, 0);
  const totalCapital = capital.reduce((sum, row) => sum + row.amount, 0);

  return {
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    capital,
    totalCapital,
    totalLiabilitiesAndCapital: totalLiabilities + totalCapital,
  };
}
