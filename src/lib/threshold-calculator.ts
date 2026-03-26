import type { ThresholdResult } from "@/types";

// 2025年(令和7年) 税制改正対応定数
const TAX_CONSTANTS = {
  // 扶養控除: 合計所得金額の上限
  dependentIncomeLimit: 580_000,

  // 勤労学生控除: 合計所得金額の上限
  workingStudentIncomeLimit: 850_000,
  workingStudentDeduction: 270_000,

  // 社会保険の扶養 (19~22歳: 150万円)
  healthInsuranceLimit_19to22: 1_500_000,
  healthInsuranceLimit_general: 1_300_000,

  // 住民税非課税 (概算、市区町村により異なる)
  residentTaxExemptionLimit: 1_350_000,
};

/**
 * 給与所得控除を計算
 * 2025年: 最低控除額65万円 (給与収入190万円以下)
 */
export function calculateSalaryIncomeDeduction(salaryRevenue: number): number {
  if (salaryRevenue <= 0) return 0;
  if (salaryRevenue <= 1_900_000) return 650_000;
  if (salaryRevenue <= 3_600_000) return Math.floor(salaryRevenue * 0.3 + 80_000);
  if (salaryRevenue <= 6_600_000) return Math.floor(salaryRevenue * 0.2 + 440_000);
  if (salaryRevenue <= 8_500_000) return Math.floor(salaryRevenue * 0.1 + 1_100_000);
  return 1_950_000;
}

/**
 * 給与所得を計算
 */
export function calculateSalaryIncome(salaryRevenue: number): number {
  if (salaryRevenue <= 0) return 0;
  const deduction = calculateSalaryIncomeDeduction(salaryRevenue);
  return Math.max(0, salaryRevenue - deduction);
}

/**
 * 事業所得を計算
 * 事業所得 = 事業収入 - 必要経費 - 青色申告特別控除
 */
export function calculateBusinessIncome(
  businessRevenue: number,
  businessExpenses: number,
  blueReturnLevel: 65 | 55
): number {
  const incomeBeforeBlue = Math.max(0, businessRevenue - businessExpenses);
  const blueDeduction = Math.min(blueReturnLevel * 10_000, incomeBeforeBlue);
  return incomeBeforeBlue - blueDeduction;
}

/**
 * 全しきい値を計算
 */
export function calculateThresholds(params: {
  salaryRevenue: number;
  businessRevenue: number;
  businessExpenses: number;
  blueReturnLevel: 65 | 55;
  age?: number;
}): ThresholdResult[] {
  const { salaryRevenue, businessRevenue, businessExpenses, blueReturnLevel, age = 19 } = params;

  const salaryIncome = calculateSalaryIncome(salaryRevenue);
  const businessIncome = calculateBusinessIncome(businessRevenue, businessExpenses, blueReturnLevel);
  const totalIncome = salaryIncome + businessIncome;

  // 社会保険の判定基準: 年間収入（事業は収入-経費、青色控除は含まない）
  const businessIncomeForInsurance = Math.max(0, businessRevenue - businessExpenses);
  const totalRevenueForInsurance = salaryRevenue + businessIncomeForInsurance;

  const results: ThresholdResult[] = [];

  // 1. 親の扶養控除の壁: 合計所得 ≤ 58万円
  results.push({
    name: "dependent_deduction",
    nameJa: "親の扶養控除",
    threshold: TAX_CONSTANTS.dependentIncomeLimit,
    currentAmount: totalIncome,
    remaining: Math.max(0, TAX_CONSTANTS.dependentIncomeLimit - totalIncome),
    percentage: totalIncome <= 0 ? 0 : Math.min(100, (totalIncome / TAX_CONSTANTS.dependentIncomeLimit) * 100),
    isExceeded: totalIncome > TAX_CONSTANTS.dependentIncomeLimit,
    description: "合計所得金額が58万円を超えると、親の税金が増えます（扶養控除が適用されなくなる）",
    basis: "合計所得金額",
  });

  // 2. 勤労学生控除の壁: 合計所得≤85万円 かつ 給与所得以外の所得≤10万円（事業所得は「給与以外」に含まれる）
  const workingStudentOkTotal = totalIncome <= TAX_CONSTANTS.workingStudentIncomeLimit;
  const workingStudentOkOther = businessIncome <= 100_000;
  const remainingTotal = TAX_CONSTANTS.workingStudentIncomeLimit - totalIncome;
  const remainingOther = 100_000 - businessIncome;
  results.push({
    name: "working_student",
    nameJa: "勤労学生控除",
    threshold: TAX_CONSTANTS.workingStudentIncomeLimit,
    currentAmount: totalIncome,
    remaining: Math.max(0, Math.min(remainingTotal, remainingOther)),
    percentage: totalIncome <= 0 ? 0 : Math.min(100, (totalIncome / TAX_CONSTANTS.workingStudentIncomeLimit) * 100),
    isExceeded: !workingStudentOkTotal || !workingStudentOkOther,
    description: "合計所得85万円以下かつ給与所得以外の所得10万円以下でないと、勤労学生控除（27万円）は受けられません（事業所得は給与以外に含まれます）",
    basis: "合計所得金額・給与以外の所得",
  });

  // 3. 社会保険の扶養の壁: 年収 ≤ 150万円 (19~22歳)
  const healthLimit = (age >= 19 && age <= 22)
    ? TAX_CONSTANTS.healthInsuranceLimit_19to22
    : TAX_CONSTANTS.healthInsuranceLimit_general;
  results.push({
    name: "health_insurance",
    nameJa: "社会保険の扶養",
    threshold: healthLimit,
    currentAmount: totalRevenueForInsurance,
    remaining: Math.max(0, healthLimit - totalRevenueForInsurance),
    percentage: totalRevenueForInsurance <= 0 ? 0 : Math.min(100, (totalRevenueForInsurance / healthLimit) * 100),
    isExceeded: totalRevenueForInsurance > healthLimit,
    description: age >= 19 && age <= 22
      ? "年間収入が150万円を超えると、親の健康保険の扶養から外れます（19~22歳特例）"
      : "年間収入が130万円を超えると、親の健康保険の扶養から外れます",
    basis: "年間収入",
  });

  // 4. 住民税非課税の壁
  results.push({
    name: "resident_tax_exempt",
    nameJa: "住民税非課税",
    threshold: TAX_CONSTANTS.residentTaxExemptionLimit,
    currentAmount: totalRevenueForInsurance,
    remaining: Math.max(0, TAX_CONSTANTS.residentTaxExemptionLimit - totalRevenueForInsurance),
    percentage: totalRevenueForInsurance <= 0 ? 0 : Math.min(100, (totalRevenueForInsurance / TAX_CONSTANTS.residentTaxExemptionLimit) * 100),
    isExceeded: totalRevenueForInsurance > TAX_CONSTANTS.residentTaxExemptionLimit,
    description: "年間収入が約135万円を超えると住民税が課税されます（市区町村により異なる）",
    basis: "年間収入（概算）",
  });

  return results;
}

/**
 * 事業所得の残り枠を計算
 * 「あといくら事業で稼げるか」を表示するため
 */
export function calculateRemainingBusinessCapacity(params: {
  salaryRevenue: number;
  currentBusinessExpenses: number;
  blueReturnLevel: 65 | 55;
}): {
  forDependentDeduction: number;
  forWorkingStudent: number;
  forHealthInsurance: number;
  salaryIncome: number;
} {
  const { salaryRevenue, currentBusinessExpenses, blueReturnLevel } = params;
  const salaryIncome = calculateSalaryIncome(salaryRevenue);
  const blueDeduction = blueReturnLevel * 10_000;

  // 扶養控除: 合計所得 ≤ 58万円
  // salaryIncome + (businessRevenue - expenses - blueDeduction) ≤ 580,000
  // businessRevenue ≤ 580,000 - salaryIncome + expenses + blueDeduction
  const forDependent = Math.max(0, TAX_CONSTANTS.dependentIncomeLimit - salaryIncome + currentBusinessExpenses + blueDeduction);

  // 勤労学生控除: 合計所得≤85万 かつ 給与所得以外≤10万 → 事業収入は min(85万-給与所得+経費+青, 10万+経費+青) まで
  const forStudentTotal = TAX_CONSTANTS.workingStudentIncomeLimit - salaryIncome + currentBusinessExpenses + blueDeduction;
  const forStudentOther = 100_000 + currentBusinessExpenses + blueDeduction;
  const forStudent = Math.max(0, Math.min(forStudentTotal, forStudentOther));

  // 社会保険: 年収(給与+事業所得) ≤ 150万円
  // salaryRevenue + (businessRevenue - expenses) ≤ 1,500,000
  // businessRevenue ≤ 1,500,000 - salaryRevenue + expenses
  const forHealth = Math.max(0, TAX_CONSTANTS.healthInsuranceLimit_19to22 - salaryRevenue + currentBusinessExpenses);

  return {
    forDependentDeduction: forDependent,
    forWorkingStudent: forStudent,
    forHealthInsurance: forHealth,
    salaryIncome,
  };
}
