import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaxReturn, calcLossHelper, formatForCopy, toCsv } from "./tax-return";
import type { SheetInput, TaxLine, TaxReturnData } from "./tax-return";

function line(
  accountCode: string,
  accountType: string,
  debitAmount: number,
  creditAmount: number,
  options: Partial<TaxLine> = {},
): TaxLine {
  return {
    period: "current",
    month: 1,
    isCarryover: false,
    accountCode,
    accountName: accountCode,
    accountType,
    accountCategory: accountType === "expense" ? "operating" : "",
    debitAmount,
    creditAmount,
    allocationPercent: 100,
    ...options,
  };
}

function sheet(lines: TaxLine[], options: Partial<SheetInput> = {}) {
  return buildTaxReturn({
    fiscalYear: 2026,
    lines,
    blueReturnLevel: 65,
    depreciation: [],
    ledger: { totalRevenue: 0, totalCogs: 0, totalExpenses: 0, operatingIncome: 0 },
    ...options,
  });
}

function amount(data: TaxReturnData, no: string) {
  const row = data.page1.find((row) => row.no === no);
  assert.ok(row);
  return row.amount;
}

test("月別売上、家事消費等、雑収入を分けて①と照合する", () => {
  const data = sheet([
    line("4001", "revenue", 0, 100, { allocationPercent: 50 }),
    line("4004", "revenue", 5, 50, { month: 12 }),
    line("4002", "revenue", 0, 20),
    line("4003", "revenue", 0, 30),
    line("4001", "revenue", 0, 999, { period: "before", month: 0 }),
  ], { ledger: { totalRevenue: 195, totalCogs: 0, totalExpenses: 0, operatingIncome: 195 } });

  assert.equal(data.monthly.length, 12);
  assert.deepEqual(data.monthly.filter((row) => row.sales !== 0), [
    { month: 1, sales: 100, purchases: 0 },
    { month: 12, sales: 45, purchases: 0 },
  ]);
  assert.equal(data.homeConsumption, 20);
  assert.equal(data.miscIncome, 30);
  assert.equal(data.salesTotal, 195);
  assert.equal(amount(data, "①"), 195);
  assert.deepEqual(data.checks.slice(0, 2).map((check) => check.level), ["ok", "ok"]);
});

test("経費は仕訳明細ごとに按分して丸め、地代家賃は全額と按分後を集計する", () => {
  const data = sheet([
    line("6016", "expense", 33, 0, { allocationPercent: 50 }),
    line("6016", "expense", 33, 0, { allocationPercent: 50 }),
    line("6016", "expense", 999, 0, { period: "before", month: 0 }),
  ]);

  assert.deepEqual(data.rent, { total: 66, business: 34 });
  assert.equal(amount(data, "㉓"), 34);
  assert.equal(amount(data, "㉜"), 34);
});

test("按分の丸めは既存の損益計算書と同じ演算順で、50円の29%は14円になる", () => {
  const data = sheet([
    line("6001", "expense", 50, 0, { allocationPercent: 29 }),
  ], { ledger: { totalRevenue: 0, totalCogs: 0, totalExpenses: 14, operatingIncome: -14 } });

  assert.equal(amount(data, "⑧"), 14);
  assert.equal(data.checks[2].level, "ok");
});

test("経費が帳簿と1円でも違えば照合で検出する", () => {
  const data = sheet([
    line("6001", "expense", 50, 0),
  ], { ledger: { totalRevenue: 0, totalCogs: 0, totalExpenses: 49, operatingIncome: -49 } });

  assert.equal(data.checks[2].level, "error");
  assert.match(data.checks[2].detail, /㉜の差額 1円/);
});

test("当年の任意経費科目をコード順に並べ、7科目目以降は雑費に含める", () => {
  const fee = line("6019", "expense", 19, 0, { accountName: "支払手数料" });
  const previous = line("5900", "expense", 99, 0, { period: "before", month: 0 });
  const single = sheet([previous, fee]);
  assert.equal(single.page1.find((row) => row.no === "㉕")?.label, "支払手数料");
  assert.equal(amount(single, "㉕"), 19);
  assert.equal(single.page1.some((row) => row.no === "㉖"), false);
  assert.equal(single.checks.length, 8);

  const data = sheet([
    ...[26, 25, 24, 23, 22, 21, 20].map((code) =>
      line(`60${code}`, "expense", code === 20 ? 0 : code, 0),
    ),
    line("6018", "expense", 3, 0),
    fee,
  ]);
  assert.equal(amount(data, "㉖"), 0);
  assert.equal(amount(data, "㉚"), 24);
  assert.equal(amount(data, "㉛"), 54);
  assert.equal(amount(data, "㉜"), 163);
  assert.equal(data.checks[8]?.level, "warn");
});

test("期末棚卸高は正の値で表示し、仕入にその他の原価科目を含める", () => {
  const data = sheet([
    line("5001", "expense", 10, 0, { accountCategory: "cogs" }),
    line("5002", "expense", 75, 0, { month: 3, accountCategory: "cogs", allocationPercent: 50 }),
    line("5004", "expense", 25, 0, { month: 3, accountCategory: "cogs" }),
    line("5003", "expense", 0, 30, { month: 12, accountCategory: "cogs" }),
  ]);
  assert.deepEqual(["②", "③", "④", "⑤", "⑥"].map((no) => amount(data, no)), [10, 100, 110, 30, 80]);
  assert.equal(data.monthly[2].purchases, 100);
  assert.equal(data.monthly[0].purchases, 0);
  assert.equal(data.monthly[11].purchases, 0);
  assert.equal(data.purchasesTotal, 100);
});

test("赤字では控除せず、黒字では控除上限と所得の少ない方を控除する", () => {
  const loss = sheet([line("6001", "expense", 407_884, 0)]);
  assert.equal(amount(loss, "㊸"), -407_884);
  assert.equal(amount(loss, "㊹"), 0);
  assert.equal(loss.blueDeduction.find((row) => row.no === "⑦")?.amount, 0);
  assert.equal(amount(loss, "㊺"), -407_884);
  assert.equal(formatForCopy(loss.income), "-407884");

  const high = sheet([line("4001", "revenue", 0, 700_000)]);
  assert.equal(high.blueReturnDeduction, 650_000);
  assert.equal(high.income, 50_000);
  assert.equal(high.blueDeduction.find((row) => row.no === "⑨")?.amount, 650_000);

  const low = sheet([line("4001", "revenue", 0, 100_000)]);
  assert.equal(low.blueReturnDeduction, low.incomeBeforeDeduction);
  assert.equal(low.income, 0);
});

const firstYear = [
  line("1011", "asset", 200, 0),
  line("4001", "revenue", 0, 200),
  line("1001", "asset", 80, 0),
  line("2005", "liability", 0, 80),
  line("1090", "asset", 35, 0),
  line("1001", "asset", 0, 35),
  line("1001", "asset", 55, 0),
  line("3001", "capital", 0, 55),
  line("6016", "expense", 33, 0, { allocationPercent: 50 }),
  line("1001", "asset", 0, 33),
];

test("初年度は期首残高がゼロで、期末に家事按分と事業主貸借を含めて一致する", () => {
  const data = sheet(firstYear);
  assert.deepEqual(data.assetTotal, { opening: 0, closing: 318 });
  assert.deepEqual(data.liabilityTotal, data.assetTotal);
  assert.ok([...data.assets, ...data.liabilities].every((row) => (row.opening ?? 0) === 0));
  assert.deepEqual(data.assets.find((row) => row.label === "事業主貸"),
    { label: "事業主貸", opening: null, closing: 51 });
  assert.deepEqual(data.liabilities.find((row) => row.label === "事業主借"),
    { label: "事業主借", opening: null, closing: 55 });
  assert.equal(data.assets.find((row) => row.label === "売掛金")?.closing, 200);
  assert.equal(data.liabilities.find((row) => row.label === "前受金")?.closing, 80);
});

test("翌年の元入金は期首の資産と負債から求め、繰越仕訳を事業主貸借に含めない", () => {
  const carryover = { isCarryover: true };
  const data = sheet([
    ...firstYear.map((row): TaxLine => ({ ...row, period: "before", month: 0 })),
    line("3001", "capital", 55, 0, carryover),
    line("3002", "capital", 0, 55, carryover),
    line("3002", "capital", 51, 0, carryover),
    line("1090", "asset", 0, 51, carryover),
    line("1001", "asset", 10, 0),
    line("3001", "capital", 0, 10),
    line("1090", "asset", 5, 0),
    line("1001", "asset", 0, 5),
  ]);

  assert.equal(data.incomeBeforeDeduction, 0);
  assert.deepEqual(data.assetTotal, { opening: 267, closing: 277 });
  assert.deepEqual(data.liabilityTotal, data.assetTotal);
  assert.deepEqual(data.liabilities.find((row) => row.label === "元入金"),
    { label: "元入金", opening: 187, closing: 187 });
  assert.equal(data.assets.find((row) => row.label === "事業主貸")?.closing, 5);
  assert.equal(data.liabilities.find((row) => row.label === "事業主借")?.closing, 10);
  assert.equal(data.checks.length, 8);
});

test("帳簿との差額をエラーとして決められた順に返す", () => {
  const data = sheet([], {
    ledger: { totalRevenue: 1, totalCogs: 2, totalExpenses: 3, operatingIncome: -4 },
  });
  assert.deepEqual(data.checks.map((check) => [check.title, check.level]), [
    ["月別売上の合計と①", "ok"],
    ["①と損益計算書(帳簿)", "error"],
    ["経費の計㉜と損益計算書(帳簿)", "error"],
    ["所得㊸と損益計算書(帳簿)", "error"],
    ["貸借対照表の貸借(期末)", "ok"],
    ["貸借対照表の貸借(期首)", "ok"],
    ["減価償却の仕訳", "ok"],
    ["減価償却費⑱と固定資産台帳", "ok"],
  ]);
  assert.match(data.checks[2].detail, /㉜.*-3.*⑥.*-2/);
});

test("減価償却の未記帳と台帳との差、および当年の元入金の仕訳を警告する", () => {
  const asset = {
    name: "備品",
    acquisitionYearMonth: "2026年1月",
    cost: 100,
    usefulLifeYears: 2,
    yearAmount: 50,
    endBookValue: 50,
  };
  const data = sheet([
    line("1001", "asset", 100, 0),
    line("3002", "capital", 0, 100),
    line("6011", "expense", 40, 0),
  ], { depreciation: [{ ...asset, alreadyRecorded: false }, { ...asset, alreadyRecorded: true }] });

  assert.deepEqual(data.checks.slice(6).map((check) => check.level), ["warn", "warn", "warn"]);
  assert.equal(data.checks[8].title, "年中に元入金の仕訳があります");
  assert.equal(data.liabilities.find((row) => row.label === "元入金")?.closing, 100);
});

test("給与と事業の通算額が負の場合だけ損失の繰越と第四表が必要になる", () => {
  for (const [businessIncome, combined, carryForward, needsForm4] of [
    [100, 300, 0, false],
    [-100, 100, 0, false],
    [-200, 0, 0, false],
    [-300, -100, 100, true],
  ] as const) {
    assert.deepEqual(calcLossHelper({ businessIncome, salaryIncome: 200 }),
      { combined, carryForward, needsForm4 });
  }
});

test("CSVはBOMとCRLFを使い、項目名をエスケープして式として解釈される接頭辞を無害化する", () => {
  const data = sheet([
    line("6019", "expense", 100, 0, { accountName: '=式,"引用"\n次の行' }),
    line("6020", "expense", 10, 0, { accountName: "+科目" }),
    line("6021", "expense", 10, 0, { accountName: "-科目" }),
    line("6022", "expense", 10, 0, { accountName: "@科目" }),
  ]);
  const csv = toCsv(data);

  assert.ok(csv.startsWith("\uFEFFページ,区分,番号,項目,期首,金額\r\n"));
  assert.ok(csv.includes(`,㉕,"'=式,""引用""\n次の行",,100\r\n`));
  assert.ok(csv.includes(",㉖,'+科目,,10\r\n"));
  assert.ok(csv.includes(",㉗,'-科目,,10\r\n"));
  assert.ok(csv.includes(",㉘,'@科目,,10\r\n"));
  assert.match(csv, /,㊺,所得金額,,-130\r\n/);
  assert.match(csv, /4,資産,,事業主貸,,0\r\n/);
  assert.match(csv, /4,負債・資本,,合計,0,-130(?:\r\n|$)/);
});
