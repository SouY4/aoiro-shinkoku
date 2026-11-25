import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, aggregateStripeFees } from "./stripe-csv";

// 引用符・カンマを含むフィールドを正しく分割できること
test("parseCsv は引用符内のカンマを1フィールドとして扱う", () => {
  const rows = parseCsv('a,b,c\n1,"x,y",3\n');
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "x,y", "3"],
  ]);
});

// balance_history.csv の形式を模した架空データ（ヘッダ＋charge/stripe_fee/対象外を含む）
const SAMPLE = `id,Type,Source,Amount,Fee,Net,Currency,Created (UTC),Available On (UTC)
txn_a,transfer,tr_a,-3000,0,-3000,jpy,2025-05-12 03:00,2025-05-18 00:00
txn_b,charge,ch_b,3000,100,2900,jpy,2025-05-12 03:00,2025-05-18 00:00
txn_c,charge,ch_c,2000,70,1930,jpy,2025-05-11 04:00,2025-05-17 00:00
txn_d,stripe_fee,,-400,40,-440,jpy,2025-05-02 05:00,2025-05-02 05:00
txn_e,charge,ch_e,4000,140,3860,jpy,2025-04-15 06:00,2025-04-21 00:00
txn_f,application_fee,fee_f,100,0,100,jpy,2025-04-03 07:00,2025-04-09 00:00
txn_g,topup,tu_g,10000,0,10000,jpy,2025-04-08 08:00,2025-04-14 00:00
`;

test("aggregateStripeFees は charge の Fee と stripe_fee の Net絶対値だけを月別合計する", () => {
  const result = aggregateStripeFees(SAMPLE);
  const may = result.find((r) => r.year === 2025 && r.month === 5);
  const apr = result.find((r) => r.year === 2025 && r.month === 4);
  assert.ok(may, "5月が存在する");
  assert.ok(apr, "4月が存在する");

  assert.equal(may!.chargeFeeTotal, 170);
  assert.equal(may!.stripeFeeTotal, 440);
  assert.equal(may!.total, 610);
  assert.equal(may!.chargeCount, 2);
  assert.equal(may!.stripeFeeCount, 1);

  assert.equal(apr!.chargeFeeTotal, 140);
  assert.equal(apr!.stripeFeeTotal, 0);
  assert.equal(apr!.total, 140);
  assert.equal(apr!.chargeCount, 1);
  assert.equal(apr!.ignoredCount, 2);
});

test("aggregateStripeFees は Created(UTC) を JST に換算して月を判定する", () => {
  const csv = `id,Type,Source,Amount,Fee,Net,Currency,Created (UTC),Available On (UTC)
txn_x,charge,ch_x,1000,33,967,jpy,2026-04-30 16:00,2026-05-06 00:00
`;
  const result = aggregateStripeFees(csv);
  assert.equal(result.length, 1);
  assert.equal(result[0].year, 2026);
  assert.equal(result[0].month, 5);
  assert.equal(result[0].chargeFeeTotal, 33);
});

test("aggregateStripeFees は必須列がなければ throw する", () => {
  assert.throws(() => aggregateStripeFees("id,Amount\n1,100\n"), /必要な列/);
});

test("aggregateStripeFees は秒付きの日時も正しく扱う", () => {
  const csv = `id,Type,Source,Amount,Fee,Net,Currency,Created (UTC),Available On (UTC)
txn_s,charge,ch_s,1000,33,967,jpy,2026-05-10 06:21:30,2026-05-16 00:00
`;
  const result = aggregateStripeFees(csv);
  assert.equal(result.length, 1);
  assert.equal(result[0].month, 5);
  assert.equal(result[0].chargeFeeTotal, 33);
});
