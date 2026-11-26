import { test } from "node:test";
import assert from "node:assert/strict";
import { calcStraightLine } from "./depreciation";

const octoberAsset = {
  cost: 300_000,
  usefulLifeYears: 4,
  acquisitionDate: new Date(2026, 9, 15),
};

test("10月取得の資産は取得年に3か月分、翌年に12か月分を償却する", () => {
  assert.deepEqual(
    calcStraightLine({ ...octoberAsset, fiscalYear: 2026, accumulatedAmount: 0 }),
    { amount: 18_750, rateMilli: 250, months: 3 },
  );
  assert.deepEqual(
    calcStraightLine({ ...octoberAsset, fiscalYear: 2027, accumulatedAmount: 18_750 }),
    { amount: 75_000, rateMilli: 250, months: 12 },
  );
});

test("未償却残高を1円残し、翌年は償却しない", () => {
  assert.equal(
    calcStraightLine({ ...octoberAsset, fiscalYear: 2030, accumulatedAmount: 243_750 }).amount,
    56_249,
  );
  assert.equal(
    calcStraightLine({ ...octoberAsset, fiscalYear: 2031, accumulatedAmount: 299_999 }).amount,
    0,
  );
});

test("耐用3年の償却率を切り上げ、1月取得なら12か月分を償却する", () => {
  assert.deepEqual(
    calcStraightLine({
      cost: 100_000,
      usefulLifeYears: 3,
      acquisitionDate: new Date(2026, 0, 5),
      fiscalYear: 2026,
      accumulatedAmount: 0,
    }),
    { amount: 33_400, rateMilli: 334, months: 12 },
  );
});

test("12月取得の資産は取得年に1か月分を償却する", () => {
  assert.deepEqual(
    calcStraightLine({
      ...octoberAsset,
      cost: 120_000,
      acquisitionDate: new Date(2026, 11, 1),
      fiscalYear: 2026,
      accumulatedAmount: 0,
    }),
    { amount: 2_500, rateMilli: 250, months: 1 },
  );
});

test("対象年より後に取得する資産は償却しない", () => {
  assert.deepEqual(
    calcStraightLine({
      ...octoberAsset,
      acquisitionDate: new Date(2027, 0, 1),
      fiscalYear: 2026,
      accumulatedAmount: 0,
    }),
    { amount: 0, rateMilli: 250, months: 0 },
  );
});

test("取得価額または耐用年数が0なら償却しない", () => {
  const params = { ...octoberAsset, fiscalYear: 2026, accumulatedAmount: 0 };
  const expected = { amount: 0, rateMilli: 0, months: 0 };
  assert.deepEqual(calcStraightLine({ ...params, cost: 0 }), expected);
  assert.deepEqual(calcStraightLine({ ...params, usefulLifeYears: 0 }), expected);
});
