# Stripe CSV 取込 → 月次手数料の自動仕訳 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stripe の `balance_history.csv` をアプリ内ページにアップロードすると、月ごとの Stripe 決済手数料（charge の手数料＋stripe_fee）を集計し、選択した月だけ「支払手数料 / その他の預金〔Stripe残高〕」の月次仕訳を自動登録する。

**Architecture:** CSV パース＋月次集計は DB 非依存の純粋関数 `src/lib/stripe-csv.ts` に切り出し、Node 組み込みテストランナー（`tsx --test`）で単体テストする。Server Action `src/actions/stripe-import-actions.ts` が設定の永続化・重複判定・既存 `createJournalEntry` 呼び出しを担う。UI は新規ページ `/journal/import-stripe`（サーバーコンポーネント）＋ `StripeImportClient`（クライアント）。ナビに「Stripe取込」を追加。

**Tech Stack:** Next.js 16 (App Router) / TypeScript / Prisma 7 (SQLite) / Server Actions / Node `node:test` + `tsx` / Tailwind CSS / lucide-react

---

## File Structure

- Create: `src/lib/stripe-csv.ts` — CSV パース＋月次手数料集計（純粋関数）。
- Create: `src/lib/stripe-csv.test.ts` — `node:test` による単体テスト。
- Modify: `package.json` — `"test"` スクリプト追加。
- Create: `src/actions/stripe-import-actions.ts` — 設定の読み書き・重複判定・取込実行（Server Action）。
- Create: `src/app/journal/import-stripe/page.tsx` — サーバーコンポーネント（科目一覧・設定取得）。
- Create: `src/components/journal/StripeImportClient.tsx` — クライアント（ファイル読込・解析・プレビュー・科目選択・登録）。
- Modify: `src/app/layout.tsx:31` — ナビに「Stripe取込」を追加。

---

## Task 1: CSV パース＋月次集計ロジック（純粋関数）

**Files:**
- Create: `src/lib/stripe-csv.ts`
- Test: `src/lib/stripe-csv.test.ts`
- Modify: `package.json`

- [ ] **Step 1: package.json に test スクリプトを追加**

`package.json` の `"scripts"` に1行追加する（他の行は変更しない）。

```json
    "mcp": "tsx mcp/server.ts",
    "test": "tsx --test src/lib/stripe-csv.test.ts"
```

- [ ] **Step 2: 失敗するテストを書く**

`src/lib/stripe-csv.test.ts` を新規作成。サンプル CSV の実値（`files/balance_history.csv` から算出済み）を使う。

```ts
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
  // 月昇順（古い順）で返る
  const may = result.find((r) => r.year === 2025 && r.month === 5);
  const apr = result.find((r) => r.year === 2025 && r.month === 4);
  assert.ok(may, "5月が存在する");
  assert.ok(apr, "4月が存在する");

  // 5月: charge手数料 100+70=170, stripe_fee |−440|=440, 合計 610
  assert.equal(may!.chargeFeeTotal, 170);
  assert.equal(may!.stripeFeeTotal, 440);
  assert.equal(may!.total, 610);
  assert.equal(may!.chargeCount, 2);
  assert.equal(may!.stripeFeeCount, 1);

  // 4月: charge手数料 297, stripe_fee 0, 合計 297。application_fee/topup は対象外
  assert.equal(apr!.chargeFeeTotal, 140);
  assert.equal(apr!.stripeFeeTotal, 0);
  assert.equal(apr!.total, 140);
  assert.equal(apr!.chargeCount, 1);
  assert.equal(apr!.ignoredCount, 2); // application_fee, topup
});

test("aggregateStripeFees は Created(UTC) を JST に換算して月を判定する", () => {
  // 2026-04-30 16:00 UTC は JST で 2026-05-01 01:00 → 5月扱い
  const csv = `id,Type,Source,Amount,Fee,Net,Currency,Created (UTC),Available On (UTC)
txn_x,charge,ch_x,1000,33,967,jpy,2026-04-30 16:00,2026-05-06 00:00
`;
  const result = aggregateStripeFees(csv);
  assert.equal(result.length, 1);
  assert.equal(result[0].year, 2026);
  assert.equal(result[0].month, 5);
  assert.equal(result[0].chargeFeeTotal, 33);
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `pnpm test`
Expected: FAIL（`stripe-csv` のエクスポートが無い／モジュール解決エラー）。

- [ ] **Step 4: 最小実装を書く**

`src/lib/stripe-csv.ts` を新規作成。

```ts
export interface MonthlyFeeSummary {
  year: number;
  month: number; // 1-12
  chargeFeeTotal: number;   // charge 行の Fee 合計
  stripeFeeTotal: number;   // stripe_fee 行の Net絶対値合計
  total: number;            // chargeFeeTotal + stripeFeeTotal
  chargeCount: number;
  stripeFeeCount: number;
  ignoredCount: number;     // 対象外 Type の件数
}

/** 引用符（"..."）と内部カンマ・改行に対応した最小 CSV パーサ。末尾の空行は無視。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // 最終フィールド／行
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 完全な空行（[""]）を除去
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** "2025-05-12 03:00"（UTC）を JST に換算して年・月を返す。 */
function toJstYearMonth(createdUtc: string): { year: number; month: number } {
  const iso = createdUtc.trim().replace(" ", "T") + ":00Z";
  const utc = new Date(iso);
  const jst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1 };
}

export function aggregateStripeFees(csvText: string): MonthlyFeeSummary[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new Error("CSV が空です");

  const header = rows[0];
  const idx = (name: string) => header.indexOf(name);
  const typeI = idx("Type");
  const feeI = idx("Fee");
  const netI = idx("Net");
  const createdI = idx("Created (UTC)");
  if (typeI < 0 || feeI < 0 || netI < 0 || createdI < 0) {
    throw new Error("必要な列（Type / Fee / Net / Created (UTC)）が見つかりません");
  }

  const map = new Map<string, MonthlyFeeSummary>();
  const keyOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const ensure = (y: number, m: number): MonthlyFeeSummary => {
    const key = keyOf(y, m);
    let s = map.get(key);
    if (!s) {
      s = { year: y, month: m, chargeFeeTotal: 0, stripeFeeTotal: 0, total: 0, chargeCount: 0, stripeFeeCount: 0, ignoredCount: 0 };
      map.set(key, s);
    }
    return s;
  };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const type = r[typeI];
    const created = r[createdI];
    if (!created) continue;
    const { year, month } = toJstYearMonth(created);
    const s = ensure(year, month);
    if (type === "charge") {
      const fee = Math.abs(parseInt(r[feeI] || "0", 10)) || 0;
      s.chargeFeeTotal += fee;
      s.chargeCount += 1;
    } else if (type === "stripe_fee") {
      const net = Math.abs(parseInt(r[netI] || "0", 10)) || 0;
      s.stripeFeeTotal += net;
      s.stripeFeeCount += 1;
    } else {
      s.ignoredCount += 1;
    }
  }

  for (const s of map.values()) s.total = s.chargeFeeTotal + s.stripeFeeTotal;

  return [...map.values()].sort((a, b) => keyOf(a.year, a.month).localeCompare(keyOf(b.year, b.month)));
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `pnpm test`
Expected: PASS（3 テストすべて成功）。

- [ ] **Step 6: コミット**

```bash
git add package.json src/lib/stripe-csv.ts src/lib/stripe-csv.test.ts
git commit -m "feat: add Stripe CSV monthly fee aggregation lib"
```

---

## Task 2: Server Action（設定・重複判定・取込実行）

**Files:**
- Create: `src/actions/stripe-import-actions.ts`

参考（既存パターン）:
- `src/actions/settings-actions.ts`（Setting の upsert / getSetting）
- `src/actions/journal-actions.ts:54`（`createJournalEntry` の引数形）
- `src/actions/account-actions.ts:5`（`getAccounts` は subAccounts を含む）
- 勘定科目コード: `支払手数料`=`6019`, `その他の預金`=`1004`（`src/lib/accounts-seed.ts`）。補助科目 `Stripe残高` は `その他の預金` の下にある想定。

- [ ] **Step 1: 実装を書く**

`src/actions/stripe-import-actions.ts` を新規作成。

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { createJournalEntry } from "./journal-actions";

const CONFIG_KEY = "stripeImportConfig";

export interface StripeImportConfig {
  debitAccountId: number;        // 借方（既定: 支払手数料 6019）
  creditAccountId: number;       // 貸方（既定: その他の預金 1004）
  creditSubAccountId: number | null; // 貸方補助科目（既定: Stripe残高）
}

/** その月の摘要文字列（重複判定のキーにもなる） */
export function feeEntryDescription(year: number, month: number): string {
  return `${year}年${month}月 Stripe決済手数料`;
}

/** 設定を取得。未保存なら勘定科目マスタから既定値を解決する。 */
export async function getStripeImportConfig(): Promise<StripeImportConfig> {
  const setting = await prisma.setting.findUnique({ where: { key: CONFIG_KEY } });
  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value) as StripeImportConfig;
      if (parsed.debitAccountId && parsed.creditAccountId) return parsed;
    } catch {
      // 壊れていれば既定値にフォールバック
    }
  }
  const debit = await prisma.account.findUnique({ where: { code: "6019" } });
  const credit = await prisma.account.findUnique({
    where: { code: "1004" },
    include: { subAccounts: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  const stripeSub = credit?.subAccounts.find((s) => s.name.includes("Stripe")) ?? credit?.subAccounts[0] ?? null;
  return {
    debitAccountId: debit?.id ?? 0,
    creditAccountId: credit?.id ?? 0,
    creditSubAccountId: stripeSub?.id ?? null,
  };
}

export async function saveStripeImportConfig(config: StripeImportConfig): Promise<void> {
  await prisma.setting.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(config) },
    create: { key: CONFIG_KEY, value: JSON.stringify(config) },
  });
}

/** 既に登録済みの月（"YYYY-M" 形式）を返す。重複計上の防止に使う。 */
export async function findExistingFeeMonths(
  months: { year: number; month: number }[]
): Promise<string[]> {
  const existing: string[] = [];
  for (const { year, month } of months) {
    const found = await prisma.journalEntry.findFirst({
      where: { description: feeEntryDescription(year, month) },
      select: { id: true },
    });
    if (found) existing.push(`${year}-${month}`);
  }
  return existing;
}

export interface ImportResult {
  createdMonths: string[];
  skippedMonths: string[];
}

/** 選択された月ごとに月次手数料仕訳を作成。既存の月はスキップ（上書きしない）。 */
export async function importStripeFees(
  selected: { year: number; month: number; total: number }[],
  config: StripeImportConfig
): Promise<ImportResult> {
  const createdMonths: string[] = [];
  const skippedMonths: string[] = [];

  for (const { year, month, total } of selected) {
    const key = `${year}-${month}`;
    if (total <= 0) {
      skippedMonths.push(key);
      continue;
    }
    const description = feeEntryDescription(year, month);
    const exists = await prisma.journalEntry.findFirst({
      where: { description },
      select: { id: true },
    });
    if (exists) {
      skippedMonths.push(key);
      continue;
    }
    const lastDay = new Date(year, month, 0).getDate();
    const date = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    await createJournalEntry({
      date,
      description,
      lines: [
        { accountId: config.debitAccountId, debitAmount: total, creditAmount: 0 },
        {
          accountId: config.creditAccountId,
          subAccountId: config.creditSubAccountId,
          debitAmount: 0,
          creditAmount: total,
        },
      ],
    });
    createdMonths.push(key);
  }

  return { createdMonths, skippedMonths };
}
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm exec tsc --noEmit`
Expected: 本ファイルに型エラーが出ないこと（既存コード由来の警告があっても本ファイルが原因でないこと）。

- [ ] **Step 3: コミット**

```bash
git add src/actions/stripe-import-actions.ts
git commit -m "feat: add Stripe import server actions (config, dedup, import)"
```

---

## Task 3: 取込ページ（サーバーコンポーネント）

**Files:**
- Create: `src/app/journal/import-stripe/page.tsx`

参考: `src/app/journal/page.tsx`（`export const dynamic = "force-dynamic"` とレイアウト）。

- [ ] **Step 1: 実装を書く**

`src/app/journal/import-stripe/page.tsx` を新規作成。

```tsx
import { getAccounts } from "@/actions/account-actions";
import { getStripeImportConfig } from "@/actions/stripe-import-actions";
import StripeImportClient from "@/components/journal/StripeImportClient";

export const dynamic = "force-dynamic";

export default async function StripeImportPage() {
  const [accounts, config] = await Promise.all([getAccounts(), getStripeImportConfig()]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Stripe取込</h1>
      <p className="text-gray-500 text-sm mb-6">
        Stripe の balance_history.csv から、月ごとの決済手数料（charge の手数料 ＋ stripe_fee）を集計して仕訳を登録します。
      </p>
      <StripeImportClient accounts={accounts} initialConfig={config} />
    </div>
  );
}
```

- [ ] **Step 2: コミット（Task 4 とまとめても可。ここでは単独コミット）**

```bash
git add src/app/journal/import-stripe/page.tsx
git commit -m "feat: add Stripe import page (server component)"
```

---

## Task 4: 取込クライアント（ファイル読込・プレビュー・登録）

**Files:**
- Create: `src/components/journal/StripeImportClient.tsx`

参考: `src/components/journal/JournalEntryFormWrapper.tsx`（"use client"、科目セレクト、Tailwind の見た目）。`getAccounts()` の戻り値は `subAccounts` を含む `Account[]`。

- [ ] **Step 1: 実装を書く**

`src/components/journal/StripeImportClient.tsx` を新規作成。

```tsx
"use client";

import { useState } from "react";
import { aggregateStripeFees, type MonthlyFeeSummary } from "@/lib/stripe-csv";
import {
  findExistingFeeMonths,
  importStripeFees,
  saveStripeImportConfig,
  type StripeImportConfig,
} from "@/actions/stripe-import-actions";

type AccountWithSub = {
  id: number;
  code: string;
  name: string;
  subAccounts: { id: number; name: string }[];
};

interface Props {
  accounts: AccountWithSub[];
  initialConfig: StripeImportConfig;
}

const keyOf = (s: { year: number; month: number }) => `${s.year}-${s.month}`;

export default function StripeImportClient({ accounts, initialConfig }: Props) {
  const [summaries, setSummaries] = useState<MonthlyFeeSummary[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<StripeImportConfig>(initialConfig);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const creditAccount = accounts.find((a) => a.id === config.creditAccountId);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setResult("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = aggregateStripeFees(text);
      setSummaries(parsed);
      const exist = await findExistingFeeMonths(parsed.map((s) => ({ year: s.year, month: s.month })));
      const existSet = new Set(exist);
      setExisting(existSet);
      // 既定で「新規かつ合計>0」のみチェック
      setChecked(new Set(parsed.filter((s) => s.total > 0 && !existSet.has(keyOf(s))).map(keyOf)));
    } catch (err) {
      setSummaries([]);
      setError(err instanceof Error ? err.message : "CSV の解析に失敗しました");
    }
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleImport() {
    setBusy(true);
    setError("");
    setResult("");
    try {
      await saveStripeImportConfig(config);
      const selected = summaries
        .filter((s) => checked.has(keyOf(s)))
        .map((s) => ({ year: s.year, month: s.month, total: s.total }));
      const res = await importStripeFees(selected, config);
      setResult(`登録 ${res.createdMonths.length} 件 / スキップ ${res.skippedMonths.length} 件`);
      // 登録済みに反映してチェックを外す
      setExisting((prev) => new Set([...prev, ...res.createdMonths]));
      setChecked(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium mb-2">balance_history.csv を選択</label>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}

      {summaries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          {/* 科目選択 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">借方科目</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                value={config.debitAccountId}
                onChange={(e) => setConfig({ ...config, debitAccountId: Number(e.target.value) })}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">貸方科目</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                value={config.creditAccountId}
                onChange={(e) =>
                  setConfig({ ...config, creditAccountId: Number(e.target.value), creditSubAccountId: null })
                }
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">貸方 補助科目</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                value={config.creditSubAccountId ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, creditSubAccountId: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">（なし）</option>
                {creditAccount?.subAccounts.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 月別プレビュー */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 w-10"></th>
                <th className="py-2">月</th>
                <th className="py-2 text-right">charge手数料</th>
                <th className="py-2 text-right">stripe_fee</th>
                <th className="py-2 text-right">合計</th>
                <th className="py-2">状態</th>
                <th className="py-2 text-right">対象外</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const key = keyOf(s);
                const isExisting = existing.has(key);
                return (
                  <tr key={key} className="border-b border-gray-100">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={checked.has(key)}
                        disabled={s.total <= 0}
                        onChange={() => toggle(key)}
                      />
                    </td>
                    <td className="py-2">{s.year}年{s.month}月</td>
                    <td className="py-2 text-right">{s.chargeFeeTotal.toLocaleString()}円</td>
                    <td className="py-2 text-right">{s.stripeFeeTotal.toLocaleString()}円</td>
                    <td className="py-2 text-right font-medium">{s.total.toLocaleString()}円</td>
                    <td className="py-2">
                      {isExisting ? (
                        <span className="text-amber-600">登録済み</span>
                      ) : (
                        <span className="text-green-600">新規</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-400">{s.ignoredCount}件</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={busy || checked.size === 0}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              選択した月を登録（{checked.size}件）
            </button>
            {result && <span className="text-sm text-gray-700">{result}</span>}
          </div>
          <p className="text-xs text-gray-400">
            ※ 仕訳は「借方 支払手数料 / 貸方 その他の預金〔Stripe残高〕」で各月の末日に登録されます。登録済みの月は二重計上防止のためスキップされます。
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm exec tsc --noEmit`
Expected: 本ファイルに型エラーが出ないこと。

- [ ] **Step 3: コミット**

```bash
git add src/components/journal/StripeImportClient.tsx
git commit -m "feat: add Stripe import client (preview, month selection, import)"
```

---

## Task 5: ナビに「Stripe取込」を追加

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: ナビ項目を追加**

`src/app/layout.tsx` の `navItems` 配列、`{ href: "/journal", label: "仕訳帳", icon: BookOpen },`（31 行目）の直後に1行追加する。アイコンは既存 import 済みの `FileText` を流用（新規 import 不要）。

```tsx
  { href: "/journal", label: "仕訳帳", icon: BookOpen },
  { href: "/journal/import-stripe", label: "Stripe取込", icon: FileText },
```

- [ ] **Step 2: コミット**

```bash
git add src/app/layout.tsx
git commit -m "feat: add Stripe import to navigation"
```

---

## Task 6: 手動E2E検証

自動テストは純粋ロジック（Task 1）のみ。UI と DB 連携は実アプリで確認する。

- [ ] **Step 1: アプリ起動**

Run: `pnpm dev`（ブラウザ `http://localhost:3000`）。必要なら `pnpm run electron:dev`。

- [ ] **Step 2: 事前確認**

設定で「その他の預金」に補助科目「Stripe残高」が存在することを確認（無ければ作成）。

- [ ] **Step 3: 取込実行**

ナビ「Stripe取込」→ `files/balance_history.csv` を選択。
Expected:
- 月別テーブルに 2026年2月〜5月が表示される。
- 各月の合計が、CSV から手計算した値（charge の Fee ＋ stripe_fee の Net 絶対値）と一致する。
- charge/stripe_fee 以外（transfer/topup/reserve/adjustment/application_fee）は「対象外」件数に出る。

- [ ] **Step 4: 登録と重複防止の確認**

借方=支払手数料・貸方=その他の預金/Stripe残高 を確認 →「選択した月を登録」。
Expected: 仕訳帳に各月末日付で「2026年5月 Stripe決済手数料」等が登録される。
再度同じ CSV を取り込むと、登録済みの月は「登録済み」と表示されチェックが外れ、再登録するとスキップされる（二重計上されない）。

- [ ] **Step 5: 検証結果を報告**（コミット不要）

---

## Self-Review

- **Spec coverage:**
  - スコープ（charge Fee＋stripe_fee のみ、他 Type 無視）→ Task 1（`aggregateStripeFees`）✓
  - 生成する仕訳（借方 支払手数料 / 貸方 その他の預金〔Stripe残高〕・月末日付・摘要）→ Task 2（`importStripeFees`/`feeEntryDescription`）✓
  - 解析ロジック（自作 CSV パーサ・UTC→JST・月別集計・純粋関数）→ Task 1 ✓
  - 重複防止（同月同摘要を検出しスキップ）→ Task 2（`findExistingFeeMonths`＋`importStripeFees` 内再チェック）, Task 4（状態表示）✓
  - 設定の永続化（Setting `stripeImportConfig`・既定値解決）→ Task 2 ✓
  - UI/画面遷移（ファイル選択→プレビュー→月選択→科目確認→登録）→ Task 3/4 ✓
  - 計上する月を選べる（チェックボックス）→ Task 4 ✓
  - ナビ追加 → Task 5 ✓
  - エラー処理（パース失敗・合計0円スキップ・既存バリデーション流用）→ Task 1（throw）/ Task 2（total<=0 skip）/ Task 4（error 表示）✓
  - テスト方針（純粋関数の単体テスト）→ Task 1 ✓
- **Placeholder scan:** TODO/TBD なし。各コード手順に完全なコードを記載。
- **Type consistency:** `MonthlyFeeSummary` / `StripeImportConfig` / `ImportResult` は Task 1・2 で定義し、Task 4 で同名・同プロパティで使用。`feeEntryDescription` は Task 2 で定義し Task 2 内で使用。`getAccounts()` の戻り値（subAccounts 含む）を Task 4 の `AccountWithSub` が構造的に満たす。
