/**
 * 減価償却計算（平成19年4月以降取得の定額法）
 * 償却率は千分率の整数で持ち、取得年は取得月を含めて月割りする。
 * 1円未満を切り捨て、未償却残高は1円残す。
 */
export function calcStraightLine(params: {
  cost: number;
  usefulLifeYears: number;
  accumulatedAmount: number;
  fiscalYear: number;
  acquisitionDate: Date;
}): { amount: number; rateMilli: number; months: number } {
  const { cost, usefulLifeYears, accumulatedAmount, fiscalYear, acquisitionDate } = params;
  if (cost <= 0 || usefulLifeYears <= 0) return { amount: 0, rateMilli: 0, months: 0 };

  const rateMilli = Math.ceil(1000 / usefulLifeYears);
  const acquisitionYear = acquisitionDate.getFullYear();
  if (acquisitionYear > fiscalYear) return { amount: 0, rateMilli, months: 0 };

  const months = acquisitionYear === fiscalYear ? 12 - acquisitionDate.getMonth() : 12;
  const proratedAmount = Math.floor(cost * rateMilli * months / 12000);
  const limit = cost - 1 - accumulatedAmount;
  const amount = Math.max(0, Math.min(proratedAmount, limit));
  return { amount, rateMilli, months };
}
