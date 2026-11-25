export interface TaxLine {
  period: "before" | "current";
  month: number;
  isCarryover: boolean;
  accountCode: string;
  accountName: string;
  accountType: string;
  accountCategory: string;
  debitAmount: number;
  creditAmount: number;
  allocationPercent: number;
}

export interface DepreciationRow {
  name: string;
  acquisitionYearMonth: string;
  cost: number;
  usefulLifeYears: number;
  yearAmount: number;
  endBookValue: number;
  alreadyRecorded: boolean;
}

export interface SheetInput {
  fiscalYear: number;
  lines: TaxLine[];
  blueReturnLevel: number;
  depreciation: DepreciationRow[];
  ledger: { totalRevenue: number; totalCogs: number; totalExpenses: number; operatingIncome: number };
}

export interface SheetRow {
  page: 1 | 2 | 3 | 4;
  section: string;
  no: string;
  label: string;
  amount: number;
  note?: string;
}

export interface BalanceRow {
  label: string;
  opening: number | null;
  closing: number;
}

export interface CheckResult {
  level: "ok" | "error" | "warn";
  title: string;
  detail: string;
}

export interface TaxReturnData {
  fiscalYear: number;
  page1: SheetRow[];
  monthly: { month: number; sales: number; purchases: number }[];
  homeConsumption: number;
  miscIncome: number;
  salesTotal: number;
  purchasesTotal: number;
  rent: { total: number; business: number };
  blueDeduction: SheetRow[];
  depreciation: DepreciationRow[];
  assets: BalanceRow[];
  liabilities: BalanceRow[];
  assetTotal: { opening: number; closing: number };
  liabilityTotal: { opening: number; closing: number };
  incomeBeforeDeduction: number;
  blueReturnDeduction: number;
  income: number;
  checks: CheckResult[];
}

const expenseFields = [
  ["6001", "⑧", "租税公課"],
  ["6002", "⑨", "荷造運賃"],
  ["6003", "⑩", "水道光熱費"],
  ["6004", "⑪", "旅費交通費"],
  ["6005", "⑫", "通信費"],
  ["6006", "⑬", "広告宣伝費"],
  ["6007", "⑭", "接待交際費"],
  ["6008", "⑮", "損害保険料"],
  ["6009", "⑯", "修繕費"],
  ["6010", "⑰", "消耗品費"],
  ["6011", "⑱", "減価償却費"],
  ["6012", "⑲", "福利厚生費"],
  ["6013", "⑳", "給料賃金"],
  ["6014", "㉑", "外注工賃"],
  ["6015", "㉒", "利子割引料"],
  ["6016", "㉓", "地代家賃"],
  ["6017", "㉔", "貸倒金"],
];
const customExpenseNumbers = ["㉕", "㉖", "㉗", "㉘", "㉙", "㉚"];

const assetFields = [
  ["1001", "現金"],
  ["1002", "当座預金"],
  ["1003", "定期預金"],
  ["1004", "その他の預金"],
  ["1010", "受取手形"],
  ["1011", "売掛金"],
  ["1012", "有価証券"],
  ["1013", "棚卸資産"],
  ["1014", "前払金"],
  ["1015", "貸付金"],
  ["1050", "建物"],
  ["1051", "建物附属設備"],
  ["1052", "機械装置"],
  ["1053", "車両運搬具"],
  ["1054", "工具器具備品"],
  ["1055", "土地"],
];
const liabilityFields = [
  ["2001", "支払手形"],
  ["2002", "買掛金"],
  ["2003", "借入金"],
  ["2004", "未払金"],
  ["2005", "前受金"],
  ["2006", "預り金"],
  ["2007", "貸倒引当金"],
];

function balanceRows(fields: string[][], balances: Map<string, BalanceRow>): BalanceRow[] {
  const fixedCodes = new Set(fields.map(([code]) => code));
  const fixed = fields.map(([code, label]) => ({
    label,
    opening: balances.get(code)?.opening ?? 0,
    closing: balances.get(code)?.closing ?? 0,
  }));
  const custom = [...balances.keys()].sort()
    .filter((code) => !fixedCodes.has(code))
    .map((code) => balances.get(code)!)
    .filter((row) => row.opening !== 0 || row.closing !== 0);
  return [...fixed, ...custom];
}

function balanceTotal(rows: BalanceRow[]) {
  return {
    opening: rows.reduce((sum, row) => sum + (row.opening ?? 0), 0),
    closing: rows.reduce((sum, row) => sum + row.closing, 0),
  };
}

function yen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

function checkComparison(title: string, amount: number, expected: number): CheckResult {
  return { level: amount === expected ? "ok" : "error", title, detail: `差額 ${yen(amount - expected)}` };
}

export function buildTaxReturn(input: SheetInput): TaxReturnData {
  const { fiscalYear, lines, blueReturnLevel, depreciation, ledger } = input;
  const monthly = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, sales: 0, purchases: 0 }));
  const expenses = new Map<string, { label: string; amount: number }>();
  const assetBalances = new Map<string, BalanceRow>();
  const liabilityBalances = new Map<string, BalanceRow>();
  let revenue = 0;
  let homeConsumption = 0;
  let miscIncome = 0;
  let openingInventory = 0;
  let purchases = 0;
  let closingInventory = 0;
  let rentTotal = 0;
  let privateUse = 0;
  let ownerDrawing = 0;
  let ownerContribution = 0;
  let capitalChange = 0;

  for (const line of lines) {
    const { accountCode: code, accountName, accountType, accountCategory } = line;
    const netDebit = line.debitAmount - line.creditAmount;
    const before = line.period === "before";
    const balances = accountType === "asset" && code !== "1090" ? assetBalances
      : accountType === "liability" ? liabilityBalances : null;

    if (balances) {
      const row = balances.get(code) ?? { label: accountName, opening: 0, closing: 0 };
      const amount = accountType === "asset" ? netDebit : -netDebit;
      if (before) row.opening = (row.opening ?? 0) + amount;
      row.closing += amount;
      balances.set(code, row);
    }

    if (before) continue;
    if (code === "6016") rentTotal += netDebit;

    if (!line.isCarryover) {
      if (code === "1090") ownerDrawing += netDebit;
      else if (code === "3001") ownerContribution -= netDebit;
      else if (accountType === "capital") capitalChange -= netDebit;
    }

    if (accountType === "revenue") {
      revenue -= netDebit;
      if (code === "4002") homeConsumption -= netDebit;
      else if (code === "4003") miscIncome -= netDebit;
      else monthly[line.month - 1].sales -= netDebit;
    } else if (accountType === "expense" && accountCategory === "cogs") {
      if (code === "5001") openingInventory += netDebit;
      else if (code === "5003") closingInventory -= netDebit;
      else {
        purchases += netDebit;
        monthly[line.month - 1].purchases += netDebit;
      }
    } else if (accountType === "expense" && accountCategory === "operating") {
      // 既存の損益計算書(getIncomeStatement)と同じ演算順。順序を変えると浮動小数の誤差で1円ずれることがある
      const amount = Math.round(netDebit * (line.allocationPercent / 100));
      const row = expenses.get(code) ?? { label: accountName, amount: 0 };
      row.amount += amount;
      expenses.set(code, row);
      privateUse += netDebit - amount;
    }
  }

  const salesTotal = monthly.reduce((sum, row) => sum + row.sales, homeConsumption + miscIncome);
  const purchasesTotal = monthly.reduce((sum, row) => sum + row.purchases, 0);
  const inventorySubtotal = openingInventory + purchases;
  const cogs = inventorySubtotal - closingInventory;
  const grossProfit = revenue - cogs;
  const expenseAmount = (code: string) => expenses.get(code)?.amount ?? 0;
  const rent = { total: rentTotal, business: expenseAmount("6016") };
  const fixedExpenseCodes = new Set([...expenseFields.map(([code]) => code), "6018"]);
  const customExpenses = [...expenses.keys()].sort().filter((code) => !fixedExpenseCodes.has(code));
  const overflowExpenses = customExpenses.slice(customExpenseNumbers.length);
  const miscExpenses = overflowExpenses.reduce((sum, code) => sum + expenseAmount(code), expenseAmount("6018"));
  const totalExpenses = [...expenses.values()].reduce((sum, row) => sum + row.amount, 0);
  const incomeBeforeDeduction = grossProfit - totalExpenses;
  const eligibleIncome = Math.max(0, incomeBeforeDeduction);
  const realEstateDeduction = 0;
  const blueReturnDeduction = Math.min(blueReturnLevel * 10_000 - realEstateDeduction, eligibleIncome);
  const income = incomeBeforeDeduction - blueReturnDeduction;

  const expenseRow = (no: string, label: string, amount: number): SheetRow =>
    ({ page: 1, section: "経費", no, label, amount });
  const page1: SheetRow[] = [
    { page: 1, section: "収入金額", no: "①", label: "売上(収入)金額(雑収入を含む)", amount: revenue },
    { page: 1, section: "売上原価", no: "②", label: "期首商品(製品)棚卸高", amount: openingInventory },
    { page: 1, section: "売上原価", no: "③", label: "仕入金額(製品製造原価)", amount: purchases },
    { page: 1, section: "売上原価", no: "④", label: "小計", amount: inventorySubtotal },
    { page: 1, section: "売上原価", no: "⑤", label: "期末商品(製品)棚卸高", amount: closingInventory },
    { page: 1, section: "売上原価", no: "⑥", label: "差引原価", amount: cogs },
    { page: 1, section: "売上原価", no: "⑦", label: "差引金額", amount: grossProfit },
    ...expenseFields.map(([code, no, label]) => expenseRow(no, label, expenseAmount(code))),
    ...customExpenses.slice(0, customExpenseNumbers.length).map((code, index) => {
      const { label, amount } = expenses.get(code)!;
      return expenseRow(customExpenseNumbers[index], label, amount);
    }),
    expenseRow("㉛", "雑費", miscExpenses),
    expenseRow("㉜", "計", totalExpenses),
    { page: 1, section: "所得金額", no: "㉝", label: "差引金額", amount: incomeBeforeDeduction },
    { page: 1, section: "繰戻額等", no: "㊲", label: "繰戻額等の計", amount: 0 },
    { page: 1, section: "繰入額等", no: "㊷", label: "繰入額等の計", amount: 0, note: "貸倒引当金・専従者給与はこのアプリでは未対応" },
    { page: 1, section: "所得金額", no: "㊸", label: "青色申告特別控除前の所得金額", amount: incomeBeforeDeduction },
    { page: 1, section: "所得金額", no: "㊹", label: "青色申告特別控除額", amount: blueReturnDeduction },
    { page: 1, section: "所得金額", no: "㊺", label: "所得金額", amount: income },
  ];
  const blueSection = "青色申告特別控除";
  const blueDeduction: SheetRow[] = [
    { page: 2, section: blueSection, no: "⑥", label: "本年分の不動産所得の金額", amount: 0 },
    { page: 2, section: blueSection, no: "⑦", label: "青色申告特別控除前の所得金額", amount: eligibleIncome },
    { page: 2, section: blueSection, no: "⑧", label: "不動産所得から差し引く青色申告特別控除額", amount: realEstateDeduction },
    { page: 2, section: blueSection, no: "⑨", label: "青色申告特別控除額", amount: blueReturnDeduction },
  ];

  const assets = balanceRows(assetFields, assetBalances);
  assets.push({ label: "事業主貸", opening: null, closing: ownerDrawing + privateUse });
  const assetTotal = balanceTotal(assets);

  const liabilities = balanceRows(liabilityFields, liabilityBalances);
  const openingCapital = assetTotal.opening - balanceTotal(liabilities).opening;
  const [reserve] = liabilities.splice(liabilityFields.length - 1, 1);
  liabilities.push(
    reserve,
    { label: "事業主借", opening: null, closing: ownerContribution },
    { label: "元入金", opening: openingCapital, closing: openingCapital + capitalChange },
    { label: "青色申告特別控除前の所得金額", opening: null, closing: incomeBeforeDeduction },
  );
  const liabilityTotal = balanceTotal(liabilities);

  const expenseDiff = totalExpenses - ledger.totalExpenses;
  const cogsDiff = cogs - ledger.totalCogs;
  const missingDepreciation = depreciation.filter((row) => row.yearAmount > 0 && !row.alreadyRecorded);
  const recordedDepreciation = depreciation.reduce((sum, row) => sum + (row.alreadyRecorded ? row.yearAmount : 0), 0);
  const depreciationExpense = expenseAmount("6011");
  const checks: CheckResult[] = [
    checkComparison("月別売上の合計と①", salesTotal, revenue),
    checkComparison("①と損益計算書(帳簿)", revenue, ledger.totalRevenue),
    {
      level: expenseDiff === 0 && cogsDiff === 0 ? "ok" : "error",
      title: "経費の計㉜と損益計算書(帳簿)",
      detail: `㉜の差額 ${yen(expenseDiff)}、⑥の差額 ${yen(cogsDiff)}`,
    },
    checkComparison("所得㊸と損益計算書(帳簿)", incomeBeforeDeduction, ledger.operatingIncome),
    ...(["closing", "opening"] as const).map((period): CheckResult => ({
      level: assetTotal[period] === liabilityTotal[period] ? "ok" : "error",
      title: `貸借対照表の貸借(${period === "closing" ? "期末" : "期首"})`,
      detail: `資産 ${yen(assetTotal[period])}、負債・資本 ${yen(liabilityTotal[period])}`,
    })),
    {
      level: missingDepreciation.length > 0 ? "warn" : "ok",
      title: "減価償却の仕訳",
      detail: missingDepreciation.length > 0
        ? `未記帳の固定資産が${missingDepreciation.length}件あります`
        : "未記帳の減価償却費はありません",
    },
    {
      level: depreciationExpense === recordedDepreciation ? "ok" : "warn",
      title: "減価償却費⑱と固定資産台帳",
      detail: `⑱ ${yen(depreciationExpense)}、台帳の仕訳済み金額 ${yen(recordedDepreciation)}`,
    },
  ];

  if (overflowExpenses.length > 0) {
    checks.push({
      level: "warn",
      title: "空欄の経費科目",
      detail: `㉛雑費に合算した科目（${overflowExpenses.length}件） ${overflowExpenses.map((code) => expenses.get(code)!.label).join("、")}`,
    });
  }
  if (capitalChange !== 0) {
    checks.push({ level: "warn", title: "年中に元入金の仕訳があります", detail: `年中の増減 ${yen(capitalChange)}` });
  }

  return {
    fiscalYear, page1, monthly, homeConsumption, miscIncome, salesTotal, purchasesTotal,
    rent, blueDeduction, depreciation, assets, liabilities, assetTotal, liabilityTotal,
    incomeBeforeDeduction, blueReturnDeduction, income, checks,
  };
}

export function calcLossHelper({ businessIncome, salaryIncome }: { businessIncome: number; salaryIncome: number }) {
  const combined = salaryIncome + businessIncome;
  const needsForm4 = businessIncome < 0 && combined < 0;
  return { combined, carryForward: needsForm4 ? -combined : 0, needsForm4 };
}

export function formatForCopy(n: number): string {
  return String(n);
}

type CsvCell = string | number | null;

function escapeCsv(value: CsvCell): string {
  if (value === null) return "";
  if (typeof value === "number") return formatForCopy(value);
  const safe = /^[=+@-]/.test(value) ? `'${value}` : value;
  return /[,"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(data: TaxReturnData): string {
  const fromSheetRow = ({ page, section, no, label, amount }: SheetRow): CsvCell[] =>
    [page, section, no, label, null, amount];
  const rows: CsvCell[][] = [
    ["ページ", "区分", "番号", "項目", "期首", "金額"],
    ...data.page1.map(fromSheetRow),
  ];

  for (const { month, sales, purchases } of data.monthly) {
    rows.push([2, "月別売上", "", `${month}月`, null, sales], [2, "月別仕入", "", `${month}月`, null, purchases]);
  }
  rows.push(
    [2, "月別売上", "", "家事消費等", null, data.homeConsumption],
    [2, "月別売上", "", "雑収入", null, data.miscIncome],
    [2, "月別売上", "", "計", null, data.salesTotal],
    [2, "月別仕入", "", "計", null, data.purchasesTotal],
    [2, "地代家賃", "", "本年中の賃借料", null, data.rent.total],
    [2, "地代家賃", "", "左の賃借料のうち必要経費算入額", null, data.rent.business],
    ...data.blueDeduction.map(fromSheetRow),
  );
  for (const row of data.depreciation) {
    const status = row.alreadyRecorded ? "仕訳済み" : row.yearAmount > 0 ? "未仕訳" : "償却額なし";
    rows.push(
      [3, "減価償却", "", `${row.name}（取得年月 ${row.acquisitionYearMonth}・${status}）`, null, null],
      [3, "減価償却", "", `${row.name}（取得価額）`, null, row.cost],
      [3, "減価償却", "", `${row.name}（耐用年数）`, null, row.usefulLifeYears],
      [3, "減価償却", "", `${row.name}（本年分の償却費）`, null, row.yearAmount],
      [3, "減価償却", "", `${row.name}（未償却残高）`, null, row.endBookValue],
    );
  }
  if (data.depreciation.length > 0) {
    const total = data.depreciation.reduce((sum, row) => sum + row.yearAmount, 0);
    rows.push([3, "減価償却", "", "本年分の償却費 合計", null, total]);
  }
  for (const { section, balances, total } of [
    { section: "資産", balances: data.assets, total: data.assetTotal },
    { section: "負債・資本", balances: data.liabilities, total: data.liabilityTotal },
  ]) {
    for (const { label, opening, closing } of balances) {
      rows.push([4, section, "", label, opening, closing]);
    }
    rows.push([4, section, "", "合計", total.opening, total.closing]);
  }

  return "\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n") + "\r\n";
}
