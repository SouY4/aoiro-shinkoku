import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBalanceSheet, type BalanceLine } from "./balance-sheet";

type Account = Pick<BalanceLine, "accountCode" | "accountName" | "accountType" | "accountCategory">;

const cash = { accountCode: "1001", accountName: "現金", accountType: "asset", accountCategory: "" };
const loan = { accountCode: "2001", accountName: "借入金", accountType: "liability", accountCategory: "" };
const drawing = { accountCode: "1090", accountName: "事業主貸", accountType: "asset", accountCategory: "" };
const contribution = { accountCode: "3001", accountName: "事業主借", accountType: "capital", accountCategory: "" };
const capital = { accountCode: "3002", accountName: "元入金", accountType: "capital", accountCategory: "" };
const sales = { accountCode: "4001", accountName: "売上高", accountType: "revenue", accountCategory: "" };
const expense = { accountCode: "6001", accountName: "通信費", accountType: "expense", accountCategory: "operating" };
const purchases = { accountCode: "5002", accountName: "仕入高", accountType: "expense", accountCategory: "cogs" };

function entry(
  debit: Account,
  credit: Account,
  amount: number,
  options: { period?: BalanceLine["period"]; isCarryover?: boolean; allocationPercent?: number } = {},
): BalanceLine[] {
  const { period = "current", isCarryover = false, allocationPercent = 100 } = options;
  return [
    { ...debit, period, isCarryover, debitAmount: amount, creditAmount: 0, allocationPercent },
    { ...credit, period, isCarryover, debitAmount: 0, creditAmount: amount, allocationPercent: 100 },
  ];
}

test("初年度は家事按分の私的利用分を事業主貸に計上する", () => {
  const result = buildBalanceSheet([
    ...entry(cash, capital, 100_000),
    ...entry(cash, sales, 50_000),
    ...entry(expense, cash, 10_000, { allocationPercent: 50 }),
  ]);

  assert.deepEqual(result.assets, [
    { account: "現金", amount: 140_000 },
    { account: "事業主貸", amount: 5_000 },
  ]);
  assert.deepEqual(result.capital, [
    { account: "元入金", amount: 100_000 },
    { account: "当期利益（損失）", amount: 45_000 },
  ]);
  assert.equal(result.totalAssets, 145_000);
  assert.equal(result.totalLiabilitiesAndCapital, result.totalAssets);
});

// 対象年は2027年。2026年の通信費10,001円は事業分5,001円、私的利用分5,000円。
const twoYears = [
  ...entry(cash, contribution, 100_000, { period: "before" }),
  ...entry(cash, sales, 50_000, { period: "before" }),
  ...entry(expense, cash, 10_001, { period: "before", allocationPercent: 50 }),
  ...entry(drawing, cash, 5_000, { period: "before" }),
  ...entry(cash, loan, 12_000, { period: "before" }),
  ...entry(cash, contribution, 20_000),
  ...entry(cash, sales, 30_000),
  ...entry(expense, cash, 5_000, { allocationPercent: 60 }),
  ...entry(drawing, cash, 3_000),
  ...entry(purchases, cash, 4_000, { allocationPercent: 50 }),
  ...entry(loan, cash, 2_000),
  ...entry(cash, capital, 7_000),
];

test("繰越仕訳がない年も前年末の純資産を元入金に集約する", () => {
  const result = buildBalanceSheet(twoYears);

  assert.deepEqual(result.assets, [
    { account: "現金", amount: 189_999 },
    { account: "事業主貸", amount: 5_000 },
  ]);
  assert.deepEqual(result.liabilities, [{ account: "借入金", amount: 10_000 }]);
  assert.deepEqual(result.capital, [
    { account: "事業主借", amount: 20_000 },
    { account: "元入金", amount: 141_999 },
    { account: "当期利益（損失）", amount: 23_000 },
  ]);
  assert.equal(result.totalAssets, 194_999);
  assert.equal(result.totalLiabilitiesAndCapital, result.totalAssets);
});

test("事業主貸と事業主借の繰越仕訳の有無で貸借対照表の表示は変わらない", () => {
  // 2027-01-01の「2026年度繰越 — 事業主借を元入金へ振替」と「2026年度繰越 — 事業主貸を元入金から控除」。
  const result = buildBalanceSheet([
    ...twoYears,
    ...entry(contribution, capital, 100_000, { isCarryover: true }),
    ...entry(capital, drawing, 10_000, { isCarryover: true }),
  ]);

  assert.deepEqual(result, buildBalanceSheet(twoYears));
  assert.equal(result.totalAssets, result.totalLiabilitiesAndCapital);
});

test("前年の私的利用分は当年の事業主貸に含まれない", () => {
  const result = buildBalanceSheet([
    ...entry(cash, capital, 100_000, { period: "before" }),
    ...entry(expense, cash, 10_000, { period: "before", allocationPercent: 50 }),
    ...entry(cash, sales, 20_000),
  ]);

  assert.deepEqual(result.assets, [{ account: "現金", amount: 110_000 }]);
  assert.deepEqual(result.capital, [
    { account: "元入金", amount: 90_000 },
    { account: "当期利益（損失）", amount: 20_000 },
  ]);
  assert.equal(result.totalAssets, result.totalLiabilitiesAndCapital);
});
