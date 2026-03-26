/**
 * 学生フリーランス扶養内最適化シミュレーター (2026年分対応)
 */

// ── 定数 ──────────────────────────────────────────
const NATIONAL_PENSION_ANNUAL = 210_120; // 2026年度 国民年金 (月額17,510円×12)

// 国保(東京23区 2026年度概算)
const NHI_MEDICAL_RATE = 0.077;      // 医療分 所得割率
const NHI_MEDICAL_FLAT = 52_000;     // 医療分 均等割
const NHI_SUPPORT_RATE = 0.028;      // 支援金分 所得割率
const NHI_SUPPORT_FLAT = 19_000;     // 支援金分 均等割
const NHI_TOTAL_RATE = NHI_MEDICAL_RATE + NHI_SUPPORT_RATE; // 10.5%
const NHI_TOTAL_FLAT = NHI_MEDICAL_FLAT + NHI_SUPPORT_FLAT; // 71,000

// 住民税
const RESIDENT_TAX_BASIC_DEDUCTION = 430_000;
const RESIDENT_TAX_STUDENT_DEDUCTION = 260_000;
const RESIDENT_TAX_RATE = 0.10;
const RESIDENT_TAX_FLAT = 5_000; // 均等割(東京23区)

// 社保扶養
const SOCIAL_INSURANCE_LIMIT_19_22 = 1_500_000;

// ── 給与所得控除 (2026年分) ──────────────────────────
export function calcSalaryDeduction2026(salary: number): number {
  if (salary <= 0) return 0;
  if (salary <= 1_900_000) return 740_000;
  if (salary <= 3_600_000) return Math.floor(salary * 0.3 + 180_000);
  if (salary <= 6_600_000) return Math.floor(salary * 0.2 + 540_000);
  if (salary <= 8_500_000) return Math.floor(salary * 0.1 + 1_200_000);
  return 1_950_000;
}

// ── 給与所得 ────────────────────────────────────────
export function calcSalaryIncome2026(salary: number): number {
  return Math.max(0, salary - calcSalaryDeduction2026(salary));
}

// ── 事業所得 ────────────────────────────────────────
export function calcBusinessIncome2026(
  revenue: number,
  expenses: number,
  proportionalExpenses: number
): number {
  const totalExpenses = expenses + proportionalExpenses;
  const beforeBlue = Math.max(0, revenue - totalExpenses);
  const blueDeduction = Math.min(650_000, beforeBlue); // 青色65万
  return beforeBlue - blueDeduction;
}

// ── 基礎控除 (2026年 所得税) ──────────────────────────
export function getBasicDeduction2026(totalIncome: number): number {
  if (totalIncome <= 1_320_000) return 1_040_000;
  if (totalIncome <= 2_320_000) return 840_000;
  if (totalIncome <= 3_320_000) return 740_000;
  if (totalIncome <= 4_320_000) return 690_000;
  if (totalIncome <= 4_890_000) return 670_000;
  if (totalIncome <= 6_550_000) return 670_000;
  if (totalIncome <= 8_500_000) return 620_000;
  if (totalIncome <= 23_500_000) return 620_000;
  // 2350万超は段階的に0
  if (totalIncome <= 24_000_000) return 480_000;
  if (totalIncome <= 24_500_000) return 320_000;
  if (totalIncome <= 25_000_000) return 160_000;
  return 0;
}

// ── 所得税の累進課税 ─────────────────────────────────
function calcProgressiveTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const brackets = [
    { limit: 1_950_000, rate: 0.05, deduction: 0 },
    { limit: 3_300_000, rate: 0.10, deduction: 97_500 },
    { limit: 6_950_000, rate: 0.20, deduction: 427_500 },
    { limit: 9_000_000, rate: 0.23, deduction: 636_000 },
    { limit: 18_000_000, rate: 0.33, deduction: 1_536_000 },
    { limit: 40_000_000, rate: 0.40, deduction: 2_796_000 },
    { limit: Infinity, rate: 0.45, deduction: 4_796_000 },
  ];
  for (const b of brackets) {
    if (taxableIncome <= b.limit) {
      return Math.floor(taxableIncome * b.rate - b.deduction);
    }
  }
  return 0;
}

// ── 社会保険の扶養判定 ─────────────────────────────────
export function calcSocialInsuranceIncome(
  salary: number,
  businessRevenue: number,
  expenses: number,
  proportionalExpenses: number
): number {
  // 社保: 給与は額面、事業は売上-経費(青色控除なし)
  return salary + Math.max(0, businessRevenue - expenses - proportionalExpenses);
}

export function isSocialInsuranceDependant(socialInsuranceIncome: number): boolean {
  return socialInsuranceIncome < SOCIAL_INSURANCE_LIMIT_19_22;
}

// ── 国民健康保険(東京23区概算) ──────────────────────────
export function calcNHI(totalIncome: number): number {
  const base = Math.max(0, totalIncome - RESIDENT_TAX_BASIC_DEDUCTION);
  // 7割軽減判定: 単身で合計所得≤43万
  const isReduced70 = totalIncome <= 430_000;
  if (isReduced70) {
    // 均等割のみ×30%
    return Math.floor(NHI_TOTAL_FLAT * 0.3);
  }
  // 通常
  const incomeComponent = Math.floor(base * NHI_TOTAL_RATE);
  return incomeComponent + NHI_TOTAL_FLAT;
}

// ── 親の控除額(特定親族特別控除) ─────────────────────────
export interface ParentDeduction {
  incomeTaxDeduction: number;
  residentTaxDeduction: number;
}

export function calcParentDeduction(totalIncome: number): ParentDeduction {
  if (totalIncome <= 580_000)  return { incomeTaxDeduction: 630_000, residentTaxDeduction: 450_000 };
  if (totalIncome <= 850_000)  return { incomeTaxDeduction: 630_000, residentTaxDeduction: 450_000 };
  if (totalIncome <= 900_000)  return { incomeTaxDeduction: 610_000, residentTaxDeduction: 450_000 };
  if (totalIncome <= 950_000)  return { incomeTaxDeduction: 510_000, residentTaxDeduction: 450_000 };
  if (totalIncome <= 1_000_000) return { incomeTaxDeduction: 410_000, residentTaxDeduction: 410_000 };
  if (totalIncome <= 1_050_000) return { incomeTaxDeduction: 310_000, residentTaxDeduction: 310_000 };
  if (totalIncome <= 1_100_000) return { incomeTaxDeduction: 210_000, residentTaxDeduction: 210_000 };
  if (totalIncome <= 1_150_000) return { incomeTaxDeduction: 110_000, residentTaxDeduction: 110_000 };
  if (totalIncome <= 1_200_000) return { incomeTaxDeduction: 60_000, residentTaxDeduction: 60_000 };
  if (totalIncome <= 1_230_000) return { incomeTaxDeduction: 30_000, residentTaxDeduction: 30_000 };
  return { incomeTaxDeduction: 0, residentTaxDeduction: 0 };
}

// ── メイン計算 ──────────────────────────────────────
export interface OptimizerInput {
  salaryRevenue: number;       // 給与収入
  businessRevenue: number;     // 事業の売上
  expenses: number;            // 必要経費
  proportionalExpenses: number; // 按分経費
  payNationalPension: boolean; // 国民年金を支払うか（学生納付特例で猶予の場合false）
}

export interface OptimizerResult {
  // 入力値
  salaryRevenue: number;
  businessRevenue: number;
  expenses: number;
  proportionalExpenses: number;
  totalExpenses: number;

  // 所得
  salaryDeduction: number;
  salaryIncome: number;
  businessIncomeBeforeBlue: number;
  blueDeduction: number;
  businessIncome: number;
  totalIncome: number;

  // 社会保険
  socialInsuranceIncome: number;
  isDependant: boolean;

  // 国民年金
  nationalPension: number;

  // 国保
  nhi: number;

  // 所得税
  basicDeduction: number;
  workingStudentDeduction: number;
  socialInsuranceDeduction: number; // 国民年金+国保
  totalIncomeDeductions: number;
  taxableIncome: number;
  incomeTax: number;
  reconstructionTax: number;
  totalIncomeTax: number;

  // 住民税
  residentBasicDeduction: number;
  residentStudentDeduction: number;
  residentSocialInsuranceDeduction: number;
  residentTotalDeductions: number;
  residentTaxableIncome: number;
  residentTaxIncome: number; // 所得割
  residentTaxFlat: number;   // 均等割
  totalResidentTax: number;

  // 手取り
  cashTakeHome: number;  // 現金手取り
  usableMoney: number;   // 使えるお金

  // 親の控除
  parentDeduction: ParentDeduction;

  // ステータス
  isWorkingStudentEligible: boolean;
}

export function calculateOptimizer(input: OptimizerInput): OptimizerResult {
  const { salaryRevenue, businessRevenue, expenses, proportionalExpenses, payNationalPension } = input;
  const totalExpenses = expenses + proportionalExpenses;

  // ── 所得 ──
  const salaryDeduction = calcSalaryDeduction2026(salaryRevenue);
  const salaryIncome = calcSalaryIncome2026(salaryRevenue);
  const businessIncomeBeforeBlue = Math.max(0, businessRevenue - totalExpenses);
  const blueDeduction = Math.min(650_000, businessIncomeBeforeBlue);
  const businessIncome = businessIncomeBeforeBlue - blueDeduction;
  const totalIncome = salaryIncome + businessIncome;

  // ── 社会保険の扶養 ──
  const socialInsuranceIncome = calcSocialInsuranceIncome(salaryRevenue, businessRevenue, expenses, proportionalExpenses);
  const isDependant = isSocialInsuranceDependant(socialInsuranceIncome);

  // ── 国民年金 ──
  const nationalPension = payNationalPension ? NATIONAL_PENSION_ANNUAL : 0;

  // ── 国保 ──
  const nhi = isDependant ? 0 : calcNHI(totalIncome);

  // ── 勤労学生控除 ──
  const isWorkingStudentEligible = totalIncome <= 850_000;
  const workingStudentDeduction = isWorkingStudentEligible ? 270_000 : 0;

  // ── 所得税 ──
  const basicDeduction = getBasicDeduction2026(totalIncome);
  const socialInsuranceDeduction = nationalPension + nhi;
  const totalIncomeDeductions = basicDeduction + workingStudentDeduction + socialInsuranceDeduction;
  const taxableIncome = Math.max(0, Math.floor((totalIncome - totalIncomeDeductions) / 1000) * 1000);
  const incomeTax = calcProgressiveTax(taxableIncome);
  const reconstructionTax = Math.floor(incomeTax * 0.021);
  const totalIncomeTax = Math.floor((incomeTax + reconstructionTax) / 100) * 100; // 100円未満切り捨て

  // ── 住民税 ──
  const residentBasicDeduction = RESIDENT_TAX_BASIC_DEDUCTION;
  const residentStudentDeduction = isWorkingStudentEligible ? RESIDENT_TAX_STUDENT_DEDUCTION : 0;
  const residentSocialInsuranceDeduction = socialInsuranceDeduction;
  const residentTotalDeductions = residentBasicDeduction + residentStudentDeduction + residentSocialInsuranceDeduction;
  const residentTaxableIncome = Math.max(0, Math.floor((totalIncome - residentTotalDeductions) / 1000) * 1000);
  const residentTaxIncome = Math.floor(residentTaxableIncome * RESIDENT_TAX_RATE / 100) * 100; // 100円未満切り捨て
  const residentTaxFlat = totalIncome > 450_000 ? RESIDENT_TAX_FLAT : 0;
  const totalResidentTax = residentTaxIncome + residentTaxFlat;

  // ── 手取り ──
  const cashTakeHome = salaryRevenue + businessRevenue - totalExpenses - nationalPension - nhi - totalIncomeTax - totalResidentTax;
  const usableMoney = cashTakeHome + expenses + proportionalExpenses; // 必要経費+按分経費を含む

  // ── 親の控除 ──
  const parentDeduction = calcParentDeduction(totalIncome);

  return {
    salaryRevenue,
    businessRevenue,
    expenses,
    proportionalExpenses,
    totalExpenses,
    salaryDeduction,
    salaryIncome,
    businessIncomeBeforeBlue,
    blueDeduction,
    businessIncome,
    totalIncome,
    socialInsuranceIncome,
    isDependant,
    nationalPension,
    nhi,
    basicDeduction,
    workingStudentDeduction,
    socialInsuranceDeduction,
    totalIncomeDeductions,
    taxableIncome,
    incomeTax,
    reconstructionTax,
    totalIncomeTax,
    residentBasicDeduction,
    residentStudentDeduction,
    residentSocialInsuranceDeduction,
    residentTotalDeductions,
    residentTaxableIncome,
    residentTaxIncome,
    residentTaxFlat,
    totalResidentTax,
    cashTakeHome,
    usableMoney,
    parentDeduction,
    isWorkingStudentEligible,
  };
}

// ── 比較用: 売上+20万のケース ──────────────────────────
export interface ComparisonResult {
  current: OptimizerResult;
  increased: OptimizerResult;
  cashDiff: number;
  usableDiff: number;
  breakEvenRevenue: number | null; // 損益分岐点の売上
}

export function calculateComparison(input: OptimizerInput): ComparisonResult {
  const current = calculateOptimizer(input);
  const increased = calculateOptimizer({
    ...input,
    businessRevenue: input.businessRevenue + 200_000,
  });

  const cashDiff = increased.cashTakeHome - current.cashTakeHome;
  const usableDiff = increased.usableMoney - current.usableMoney;

  // 損益分岐点を探す(扶養内の手取りを超える売上)
  let breakEvenRevenue: number | null = null;
  if (current.isDependant && !increased.isDependant) {
    // 扶養から外れたケース → 分岐点を探す
    const currentCash = current.cashTakeHome;
    // 売上を1万円刻みで増やして、手取りが現在を超えるポイントを探す
    for (let rev = input.businessRevenue + 10_000; rev <= input.businessRevenue + 3_000_000; rev += 10_000) {
      const trial = calculateOptimizer({ ...input, businessRevenue: rev });
      if (trial.cashTakeHome > currentCash) {
        breakEvenRevenue = rev;
        break;
      }
    }
  }

  return { current, increased, cashDiff, usableDiff, breakEvenRevenue };
}
