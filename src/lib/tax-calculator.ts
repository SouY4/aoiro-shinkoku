import type { TaxCalculation } from "@/types";
import { calculateSalaryIncome, calculateSalaryIncomeDeduction } from "./threshold-calculator";

/**
 * 基礎控除を計算 (2025年 令和7年 改正対応)
 * 合計所得金額に応じた段階制
 */
function getBasicDeduction(totalIncome: number): number {
  if (totalIncome <= 1_320_000) return 950_000;
  if (totalIncome <= 3_360_000) return 880_000;
  if (totalIncome <= 4_890_000) return 680_000;
  if (totalIncome <= 6_550_000) return 630_000;
  if (totalIncome <= 23_500_000) return 580_000;
  return 0;
}

/**
 * 累進課税額を計算
 */
function calculateProgressiveTax(taxableIncome: number): number {
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
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.limit) {
      return Math.floor(taxableIncome * bracket.rate - bracket.deduction);
    }
  }
  return 0;
}

/**
 * 所得税を計算
 */
export function calculateIncomeTax(params: {
  salaryRevenue: number;
  businessRevenue: number;
  businessExpenses: number;
  isStudent: boolean;
  blueReturnLevel: 65 | 55;
}): TaxCalculation {
  const { salaryRevenue, businessRevenue, businessExpenses, isStudent, blueReturnLevel } = params;

  // Step 1: 給与所得
  const salaryIncomeDeduction = calculateSalaryIncomeDeduction(salaryRevenue);
  const salaryIncome = calculateSalaryIncome(salaryRevenue);

  // Step 2: 事業所得
  const businessIncomeBeforeBlue = Math.max(0, businessRevenue - businessExpenses);
  const blueReturnDeduction = Math.min(blueReturnLevel * 10_000, businessIncomeBeforeBlue);
  const businessIncome = businessIncomeBeforeBlue - blueReturnDeduction;

  // Step 3: 合計所得金額
  const totalIncome = salaryIncome + businessIncome;

  // Step 4: 所得控除
  const basicDeduction = getBasicDeduction(totalIncome);
  // 勤労学生控除: 合計所得≤85万 かつ 給与所得以外の所得≤10万（事業所得は「給与以外」に含まれる）
  const otherThanSalaryIncome = businessIncome;
  const workingStudentDeduction =
    isStudent && totalIncome <= 850_000 && otherThanSalaryIncome <= 100_000 ? 270_000 : 0;
  const totalDeductions = basicDeduction + workingStudentDeduction;

  // Step 5: 課税所得金額 (1000円未満切り捨て)
  const taxableIncome = Math.max(0, Math.floor((totalIncome - totalDeductions) / 1000) * 1000);

  // Step 6: 所得税額
  const incomeTax = calculateProgressiveTax(taxableIncome);

  // Step 7: 復興特別所得税 (2.1%)
  const reconstructionTax = Math.floor(incomeTax * 0.021);

  return {
    salaryRevenue,
    salaryIncomeDeduction,
    salaryIncome,
    businessRevenue,
    businessExpenses,
    blueReturnDeduction,
    businessIncome,
    totalIncome,
    basicDeduction,
    workingStudentDeduction,
    totalDeductions,
    taxableIncome,
    incomeTax,
    reconstructionTax,
    totalTax: incomeTax + reconstructionTax,
  };
}
