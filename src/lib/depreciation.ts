/**
 * 減価償却計算（定額法）
 * 残存価格0を前提。毎年 取得価額 / 耐用年数 を償却。
 * 未償却残高を超えないようにする。
 */
export function straightLineDepreciation(params: {
  cost: number;
  usefulLifeYears: number;
  accumulatedAmount: number;
  fiscalYearStart: Date; // 対象年度の1月1日
  acquisitionDate: Date;
}): number {
  const { cost, usefulLifeYears, accumulatedAmount, fiscalYearStart, acquisitionDate } = params;
  if (cost <= 0 || usefulLifeYears <= 0) return 0;
  const annualAmount = Math.floor(cost / usefulLifeYears);
  const remaining = cost - accumulatedAmount;
  if (remaining <= 0) return 0;

  const yearEnd = new Date(fiscalYearStart.getFullYear(), 11, 31);
  if (acquisitionDate > yearEnd) return 0; // 取得日が年度末より後ならその年度は償却なし

  const amount = Math.min(annualAmount, remaining);
  return amount;
}
