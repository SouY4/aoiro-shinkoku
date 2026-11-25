/**
 * AoiroShinkoku MCP Server
 * Claude Desktop / Claude Code から青色申告アプリの帳簿を操作するサーバー
 *
 * 起動: pnpm run mcp
 * 設定: claude_desktop_config.json に登録して使う
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";

// ── DB接続 ────────────────────────────────────────────────────────────────
// process.cwd() を基準にすると、MCPクライアントがどこから起動したかで別のDBを
// 掴んでしまう(実際 prisma/data/ の3月時点の古いコピーを参照していた)。
// このファイルの位置からリポジトリルートを求め、アプリ本体(src/lib/prisma.ts)と
// 同じ data/database.sqlite を見る。
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = process.env.DATABASE_URL
  ? path.resolve(PROJECT_ROOT, process.env.DATABASE_URL.replace(/^file:/, ""))
  : path.join(PROJECT_ROOT, "data", "database.sqlite");
import fs from "fs";
if (!fs.existsSync(DB_PATH)) {
  process.stderr.write(
    `[aoiro-mcp] DBが見つかりません: ${DB_PATH}\n` +
    `[aoiro-mcp] 先に "pnpm prisma migrate dev && pnpm prisma db seed" を実行してください。\n`
  );
  process.exit(1);
}
const db = new Database(DB_PATH, { readonly: false });
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── 仕訳提案キーワードルール ──────────────────────────────────────────────
const SUGGESTION_RULES: { patterns: string[]; debitCode: string; creditCode: string; label: string }[] = [
  { patterns: ["github", "vercel", "netlify", "heroku", "aws", "gcp", "azure", "さくら", "conoha", "xserver", "ドメイン", "サーバー"],
    debitCode: "6005", creditCode: "3001", label: "通信費（事業主借）" },
  { patterns: ["adobe", "figma", "notion", "slack", "chatgpt", "openai", "claude", "cursor", "copilot"],
    debitCode: "6010", creditCode: "3001", label: "消耗品費（事業主借）" },
  { patterns: ["icloud", "google one", "dropbox", "onedrive"],
    debitCode: "6005", creditCode: "3001", label: "通信費（事業主借）" },
  { patterns: ["書籍", "本", "技術書", "書店", "amazon"],
    debitCode: "6010", creditCode: "3001", label: "消耗品費（書籍）" },
  { patterns: ["電車", "新幹線", "バス", "タクシー", "ic", "suica", "pasmo"],
    debitCode: "6004", creditCode: "3001", label: "旅費交通費" },
  // 「車両費」という科目は存在しないため旅費交通費に寄せる
  { patterns: ["ガソリン", "駐車"],
    debitCode: "6004", creditCode: "3001", label: "旅費交通費（車両）" },
  // 「会議費」という科目は存在しないため接待交際費に寄せる
  { patterns: ["会議", "打ち合わせ", "ミーティング", "カフェ", "コーヒー"],
    debitCode: "6007", creditCode: "3001", label: "接待交際費（会議）" },
  { patterns: ["電気", "ガス", "水道"],
    debitCode: "6003", creditCode: "3001", label: "水道光熱費（按分要確認）" },
  { patterns: ["携帯", "スマホ", "docomo", "au", "softbank", "rakuten mobile"],
    debitCode: "6005", creditCode: "3001", label: "通信費（携帯）" },
  { patterns: ["インターネット", "光", "wifi", "nuro", "ntt"],
    debitCode: "6005", creditCode: "3001", label: "通信費（ネット）" },
  { patterns: ["文具", "コンビニ", "100均", "ダイソー", "usb", "hdmi", "ケーブル"],
    debitCode: "6010", creditCode: "3001", label: "消耗品費" },
  // 「研修費」という科目は存在しないため雑費に寄せる
  { patterns: ["セミナー", "勉強会", "研修", "講座", "udemy", "connpass"],
    debitCode: "6018", creditCode: "3001", label: "雑費（研修）" },
  { patterns: ["入金", "振込", "売上"],
    debitCode: "1004", creditCode: "4001", label: "売上入金（預金）" },
];

function suggestAccounts(text: string): { debitCode: string; creditCode: string; label: string; confidence: string } {
  const lower = text.toLowerCase();
  for (const rule of SUGGESTION_RULES) {
    if (rule.patterns.some((p) => lower.includes(p))) {
      return { ...rule, confidence: "high" };
    }
  }
  return { debitCode: "6010", creditCode: "3001", label: "消耗品費（推定・要確認）", confidence: "low" };
}

// ── ヘルパー ──────────────────────────────────────────────────────────────
function getAccountByCode(code: string) {
  return db.prepare('SELECT * FROM "Account" WHERE code = ?').get(code) as
    | { id: number; code: string; name: string; type: string } | undefined;
}

function currentFiscalYear(): number {
  const row = db.prepare('SELECT value FROM "Setting" WHERE key = ?').get("fiscalYear") as
    | { value: string } | undefined;
  return parseInt(row?.value ?? String(new Date().getFullYear()));
}

function getSubAccount(accountId: number, name: string) {
  return db.prepare('SELECT * FROM "SubAccount" WHERE accountId = ? AND name = ?')
    .get(accountId, name) as { id: number; name: string } | undefined;
}

// 仕訳明細の入力型。create と update で共有する。
type LineInput = {
  accountCode: string;
  subAccountName?: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  allocationPercent?: number;
};

type ResolvedLine = {
  accountId: number; accountName: string;
  subAccountId: number | null; subAccountName: string | null;
  debitAmount: number; creditAmount: number;
  description: string | null; allocationPercent: number;
};

/** 科目コード・補助科目名をIDに解決する。見つからなければ throw。 */
function resolveLines(lines: LineInput[]): ResolvedLine[] {
  return lines.map((l) => {
    const account = getAccountByCode(l.accountCode);
    if (!account) {
      throw new Error(`科目コード "${l.accountCode}" が見つかりません。list_accounts で確認してください。`);
    }
    let subAccountId: number | null = null;
    let subAccountName: string | null = null;
    if (l.subAccountName) {
      const sub = getSubAccount(account.id, l.subAccountName);
      if (!sub) {
        throw new Error(
          `科目 ${account.code} ${account.name} に補助科目 "${l.subAccountName}" がありません。`
        );
      }
      subAccountId = sub.id;
      subAccountName = sub.name;
    }
    return {
      accountId: account.id, accountName: account.name,
      subAccountId, subAccountName,
      debitAmount: l.debitAmount ?? 0, creditAmount: l.creditAmount ?? 0,
      description: l.description ?? null,
      allocationPercent: l.allocationPercent ?? 100,
    };
  });
}

/** 貸借一致を検証する。問題があればメッセージ、なければ null。 */
function validateBalance(lines: { debitAmount: number; creditAmount: number }[]): string | null {
  const d = lines.reduce((s, l) => s + (l.debitAmount ?? 0), 0);
  const c = lines.reduce((s, l) => s + (l.creditAmount ?? 0), 0);
  if (d !== c) {
    return `借方合計(¥${d.toLocaleString()}) ≠ 貸方合計(¥${c.toLocaleString()})`;
  }
  if (d === 0) return "金額がすべて0です。";
  return null;
}

/** 監査ログ用のスナップショット。訂正前後の状態を残すために使う。 */
function snapshotEntry(entryId: number) {
  const e = db.prepare(
    'SELECT date, description, isAdjusting FROM "JournalEntry" WHERE id = ?'
  ).get(entryId) as { date: string; description: string; isAdjusting: number } | undefined;
  if (!e) return null;
  const lines = db.prepare(
    `SELECT accountId, subAccountId, debitAmount, creditAmount, description, allocationPercent
     FROM "JournalLine" WHERE journalEntryId = ? ORDER BY id`
  ).all(entryId);
  return { description: e.description, date: e.date, isAdjusting: !!e.isAdjusting, lines };
}

/** 明細を人が読める形に整形する。 */
function formatLines(lines: ResolvedLine[]): string {
  return lines.map((l) => {
    const name = l.subAccountName ? `${l.accountName}[${l.subAccountName}]` : l.accountName;
    const alloc = l.allocationPercent !== 100 ? `（事業割合${l.allocationPercent}%）` : "";
    return l.debitAmount > 0
      ? `  借: ${name} ¥${l.debitAmount.toLocaleString()}${alloc}`
      : `  貸: ${name} ¥${l.creditAmount.toLocaleString()}${alloc}`;
  }).join("\n");
}

// 証憑ファイルの置き場。アプリ側と同じ data/receipts を使う。
const RECEIPT_DIR = path.join(PROJECT_ROOT, "data", "receipts");
const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".heic": "image/heic", ".heif": "image/heif",
};

// ── 起動時チェック ────────────────────────────────────────────────────────
// SUGGESTION_RULES のコードが Account テーブルに実在するか検証する。
// 実在しないコードを提案すると、誤った科目のまま記帳されて帳簿が壊れるため。
for (const rule of SUGGESTION_RULES) {
  for (const code of [rule.debitCode, rule.creditCode]) {
    if (!getAccountByCode(code)) {
      process.stderr.write(
        `[aoiro-mcp] 警告: ルール「${rule.label}」の科目コード ${code} が存在しません\n`
      );
    }
  }
}

// ── MCPサーバー定義 ───────────────────────────────────────────────────────
const server = new McpServer({
  name: "aoiro-shinkoku",
  version: "1.0.0",
});

// ─────────────────────────────────────────────────────────────────────────
// TOOL: 勘定科目一覧
// ─────────────────────────────────────────────────────────────────────────
server.tool(
  "list_accounts",
  "勘定科目の一覧を取得する。仕訳作成前に科目コードを確認するために使う。",
  {},
  async () => {
    const rows = db.prepare(
      'SELECT code, name, type, category FROM "Account" WHERE isActive = 1 ORDER BY sortOrder, code'
    ).all() as { code: string; name: string; type: string; category: string }[];

    const grouped: Record<string, typeof rows> = {};
    for (const r of rows) {
      (grouped[r.type] ??= []).push(r);
    }

    const typeLabel: Record<string, string> = {
      asset: "資産", liability: "負債", capital: "資本", revenue: "収益", expense: "費用",
    };

    const lines = Object.entries(grouped).map(([type, accounts]) =>
      `【${typeLabel[type] ?? type}】\n` +
      accounts.map((a) => `  ${a.code} ${a.name}`).join("\n")
    );

    return { content: [{ type: "text", text: lines.join("\n\n") }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: 仕訳検索
// ─────────────────────────────────────────────────────────────────────────
server.tool(
  "search_entries",
  "仕訳帳を検索する。日付・金額・科目名・摘要キーワードで絞り込める。",
  {
    dateFrom:    z.string().optional().describe("開始日 YYYY-MM-DD（省略可）"),
    dateTo:      z.string().optional().describe("終了日 YYYY-MM-DD（省略可）"),
    amountMin:   z.number().optional().describe("金額下限（省略可）"),
    amountMax:   z.number().optional().describe("金額上限（省略可）"),
    accountName: z.string().optional().describe("科目名の部分一致（省略可）"),
    keyword:     z.string().optional().describe("摘要の部分一致（省略可）"),
    limit:       z.number().optional().describe("取得件数（デフォルト20）"),
  },
  async ({ dateFrom, dateTo, amountMin, amountMax, accountName, keyword, limit }) => {
    const fiscalYear = currentFiscalYear();
    const from = dateFrom ?? `${fiscalYear}-01-01`;
    const to   = dateTo   ?? `${fiscalYear}-12-31`;
    const take = limit ?? 20;

    interface EntryRow { id: number; date: string; description: string; isAdjusting: number }
    const entries = db.prepare(
      `SELECT id, date, description, isAdjusting FROM "JournalEntry"
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC, id ASC`
    ).all(from + "T00:00:00.000Z", to + "T23:59:59.999Z") as EntryRow[];

    interface LineRow { journalEntryId: number; debitAmount: number; creditAmount: number; description: string | null; name: string }
    const allLines = db.prepare(
      `SELECT jl.journalEntryId, jl.debitAmount, jl.creditAmount, jl.description, a.name
       FROM "JournalLine" jl JOIN "Account" a ON a.id = jl.accountId`
    ).all() as LineRow[];

    const lineMap = new Map<number, LineRow[]>();
    for (const l of allLines) {
      (lineMap.get(l.journalEntryId) ?? lineMap.set(l.journalEntryId, []).get(l.journalEntryId)!).push(l);
    }

    const results = entries
      .filter((e) => {
        if (keyword && !e.description.toLowerCase().includes(keyword.toLowerCase())) return false;
        const lines = lineMap.get(e.id) ?? [];
        if (accountName && !lines.some((l) => l.name.toLowerCase().includes(accountName.toLowerCase()))) return false;
        if (amountMin !== undefined || amountMax !== undefined) {
          const max = Math.max(...lines.map((l) => Math.max(l.debitAmount, l.creditAmount)));
          if (amountMin !== undefined && max < amountMin) return false;
          if (amountMax !== undefined && max > amountMax) return false;
        }
        return true;
      })
      .slice(0, take);

    if (results.length === 0) {
      return { content: [{ type: "text", text: "条件に一致する仕訳はありません。" }] };
    }

    const text = results.map((e) => {
      const lines = lineMap.get(e.id) ?? [];
      const debits  = lines.filter((l) => l.debitAmount  > 0).map((l) => `  借: ${l.name} ¥${l.debitAmount.toLocaleString()}`).join("\n");
      const credits = lines.filter((l) => l.creditAmount > 0).map((l) => `  貸: ${l.name} ¥${l.creditAmount.toLocaleString()}`).join("\n");
      const date = new Date(e.date).toLocaleDateString("ja-JP");
      return `[#${e.id}] ${date}${e.isAdjusting ? " [決算整理]" : ""} — ${e.description}\n${debits}\n${credits}`;
    }).join("\n\n");

    return { content: [{ type: "text", text: `${results.length}件の仕訳:\n\n${text}` }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: 損益計算書
// ─────────────────────────────────────────────────────────────────────────
server.tool(
  "get_income_statement",
  "指定年度の損益計算書（P/L）を取得する。売上・経費・利益の概要を確認できる。",
  { fiscalYear: z.number().optional().describe("会計年度（省略時は現在の設定年度）") },
  async ({ fiscalYear }) => {
    const year = fiscalYear ?? currentFiscalYear();
    const startDate = `${year}-01-01T00:00:00.000Z`;
    const endDate   = `${year + 1}-01-01T00:00:00.000Z`;

    interface LineRow { type: string; category: string; name: string; debitAmount: number; creditAmount: number; allocationPercent: number }
    const lines = db.prepare(
      `SELECT a.type, a.category, a.name, jl.debitAmount, jl.creditAmount, jl.allocationPercent
       FROM "JournalLine" jl
       JOIN "Account" a ON a.id = jl.accountId
       JOIN "JournalEntry" je ON je.id = jl.journalEntryId
       WHERE je.date >= ? AND je.date < ?`
    ).all(startDate, endDate) as LineRow[];

    const revenue: Record<string, number> = {};
    const cogs:    Record<string, number> = {};
    const expense: Record<string, number> = {};

    for (const l of lines) {
      if (l.type === "revenue") {
        revenue[l.name] = (revenue[l.name] ?? 0) + (l.creditAmount - l.debitAmount);
      } else if (l.type === "expense" && l.category === "cogs") {
        cogs[l.name] = (cogs[l.name] ?? 0) + (l.debitAmount - l.creditAmount);
      } else if (l.type === "expense" && l.category === "operating") {
        const ratio = (l.allocationPercent ?? 100) / 100;
        expense[l.name] = (expense[l.name] ?? 0) + Math.round((l.debitAmount - l.creditAmount) * ratio);
      }
    }

    const totalRevenue  = Object.values(revenue).reduce((s, v) => s + v, 0);
    const totalCogs     = Object.values(cogs).reduce((s, v) => s + v, 0);
    const totalExpense  = Object.values(expense).reduce((s, v) => s + v, 0);
    const grossProfit   = totalRevenue - totalCogs;
    const operatingIncome = grossProfit - totalExpense;

    const fmt = (n: number) => `¥${n.toLocaleString()}`;
    const lines2 = [
      `── ${year}年度 損益計算書 ──`,
      `売上高:       ${fmt(totalRevenue)}`,
      ...(totalCogs > 0 ? [`  売上原価:   ${fmt(totalCogs)}`] : []),
      `売上総利益:   ${fmt(grossProfit)}`,
      `経費合計:     ${fmt(totalExpense)}`,
      `  ` + Object.entries(expense).map(([k, v]) => `${k}: ${fmt(v)}`).join("\n  "),
      `営業利益:     ${fmt(operatingIncome)}`,
    ];

    return { content: [{ type: "text", text: lines2.join("\n") }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: 月別売上
// ─────────────────────────────────────────────────────────────────────────
server.tool(
  "get_monthly_sales",
  "指定年度の月別売上を取得する。青色申告決算書2ページ目への記入に使う。",
  { fiscalYear: z.number().optional().describe("会計年度（省略時は現在の設定年度）") },
  async ({ fiscalYear }) => {
    const year = fiscalYear ?? currentFiscalYear();

    interface MonthRow { month: number; revenue: number }
    const rows = db.prepare(
      `SELECT CAST(strftime('%m', je.date) AS INTEGER) as month,
              SUM(jl.creditAmount - jl.debitAmount) as revenue
       FROM "JournalLine" jl
       JOIN "Account" a ON a.id = jl.accountId
       JOIN "JournalEntry" je ON je.id = jl.journalEntryId
       WHERE a.type = 'revenue'
         AND je.date >= ? AND je.date < ?
       GROUP BY month
       ORDER BY month`
    ).all(`${year}-01-01T00:00:00.000Z`, `${year + 1}-01-01T00:00:00.000Z`) as MonthRow[];

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      revenue: rows.find((r) => r.month === i + 1)?.revenue ?? 0,
    }));

    const total = monthly.reduce((s, r) => s + r.revenue, 0);
    const lines = monthly
      .map((r) => `  ${r.month}月: ¥${r.revenue.toLocaleString()}${r.revenue === 0 ? " —" : ""}`)
      .join("\n");

    return {
      content: [{
        type: "text",
        text: `── ${year}年度 月別売上 ──\n${lines}\n\n合計: ¥${total.toLocaleString()}`,
      }],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: 仕訳提案
// ─────────────────────────────────────────────────────────────────────────
server.tool(
  "suggest_journal_entry",
  "支払い内容のテキストと金額から仕訳を提案する。create_journal_entry を呼ぶ前に使う。",
  {
    description: z.string().describe("支払い内容（例: 'GitHub Pro 月額', 'Suicaでランチ代'）"),
    amount:      z.number().describe("金額（円）"),
    date:        z.string().optional().describe("日付 YYYY-MM-DD（省略時は今日）"),
    payWithPersonalCard: z.boolean().optional().describe("個人カード払いか（trueなら貸方を事業主借にする）"),
  },
  async ({ description, amount, date, payWithPersonalCard }) => {
    const suggestion = suggestAccounts(description);

    // 個人カード払い以外（事業口座払い）なら貸方を預金に
    if (payWithPersonalCard === false) {
      suggestion.creditCode = "1004";
      suggestion.label = suggestion.label.replace("事業主借", "その他の預金");
    }

    const debitAccount  = getAccountByCode(suggestion.debitCode);
    const creditAccount = getAccountByCode(suggestion.creditCode);

    const d = date ?? new Date().toISOString().slice(0, 10);

    const text = [
      `【仕訳提案】 信頼度: ${suggestion.confidence}`,
      `日付: ${d}`,
      `摘要: ${description}`,
      ``,
      `  借方: ${debitAccount?.name ?? "?"} (${suggestion.debitCode})  ¥${amount.toLocaleString()}`,
      `  貸方: ${creditAccount?.name ?? "?"} (${suggestion.creditCode})  ¥${amount.toLocaleString()}`,
      ``,
      `根拠: ${suggestion.label}`,
      ``,
      `この内容でよければ create_journal_entry を呼んでください。`,
      `科目を変更する場合は list_accounts で科目コードを確認してください。`,
    ].join("\n");

    return { content: [{ type: "text", text }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: 仕訳作成
// ─────────────────────────────────────────────────────────────────────────
server.tool(
  "create_journal_entry",
  "新しい仕訳を帳簿に追加する。借方合計 = 貸方合計でなければエラーになる。",
  {
    date:        z.string().describe("仕訳日 YYYY-MM-DD"),
    description: z.string().describe("摘要（例: 'GitHub Pro 月額'）"),
    lines: z.array(z.object({
      accountCode:       z.string().describe("勘定科目コード（例: '6005'）"),
      subAccountName:    z.string().optional().describe("補助科目名（例: 'Stripe残高' / '銀行口座'）。1004など補助科目のある科目で使う"),
      debitAmount:       z.number().describe("借方金額（貸方のときは0）"),
      creditAmount:      z.number().describe("貸方金額（借方のときは0）"),
      description:       z.string().optional().describe("明細ごとの摘要（省略可）"),
      allocationPercent: z.number().optional().describe("事業割合 0-100（省略時100）"),
    })).describe("仕訳明細。借方は debitAmount > 0、貸方は creditAmount > 0 にする"),
    isAdjusting: z.boolean().optional().describe("決算整理仕訳か（省略時false）"),
  },
  async ({ date, description, lines, isAdjusting }) => {
    // バリデーション
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { content: [{ type: "text", text: "エラー: 日付は YYYY-MM-DD 形式で指定してください。" }], isError: true };
    }
    if (!description?.trim()) {
      return { content: [{ type: "text", text: "エラー: 摘要を入力してください。" }], isError: true };
    }
    if (!lines || lines.length < 2) {
      return { content: [{ type: "text", text: "エラー: 最低2行の明細が必要です。" }], isError: true };
    }

    const imbalance = validateBalance(lines);
    if (imbalance) {
      return { content: [{ type: "text", text: `エラー: ${imbalance}` }], isError: true };
    }

    try {
      const resolvedLines = resolveLines(lines as LineInput[]);

      const insert = db.transaction(() => {
        const entryResult = db.prepare(
          `INSERT INTO "JournalEntry" (date, description, isAdjusting, createdAt, updatedAt)
           VALUES (?, ?, ?, datetime('now'), datetime('now'))`
        ).run(new Date(date).toISOString(), description.trim(), isAdjusting ? 1 : 0);

        const entryId = entryResult.lastInsertRowid as number;

        for (const l of resolvedLines) {
          db.prepare(
            `INSERT INTO "JournalLine"
               (journalEntryId, accountId, subAccountId, debitAmount, creditAmount, description, allocationPercent)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(entryId, l.accountId, l.subAccountId, l.debitAmount, l.creditAmount, l.description, l.allocationPercent);
        }

        db.prepare(
          `INSERT INTO "JournalAuditLog" (journalEntryId, action, afterData, changedAt)
           VALUES (?, 'create', ?, datetime('now'))`
        ).run(entryId, JSON.stringify(snapshotEntry(entryId)));

        return entryId;
      });

      const entryId = insert();
      return {
        content: [{
          type: "text",
          text: `✅ 仕訳 #${entryId} を作成しました。\n\n日付: ${date}\n摘要: ${description}\n${formatLines(resolvedLines)}`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `エラー: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: 仕訳の訂正
// ─────────────────────────────────────────────────────────────────────────
server.tool(
  "update_journal_entry",
  "既存の仕訳を訂正する。指定した項目だけ更新し、訂正前後の内容が監査ログに残る。lines を渡した場合は明細を全置換する。",
  {
    entryId:     z.number().describe("訂正する仕訳のID（search_entries の [#N] の N）"),
    date:        z.string().optional().describe("仕訳日 YYYY-MM-DD（変更しないなら省略）"),
    description: z.string().optional().describe("摘要（変更しないなら省略）"),
    lines: z.array(z.object({
      accountCode:       z.string().describe("勘定科目コード（例: '6005'）"),
      subAccountName:    z.string().optional().describe("補助科目名（例: 'Stripe残高'）"),
      debitAmount:       z.number().describe("借方金額（貸方のときは0）"),
      creditAmount:      z.number().describe("貸方金額（借方のときは0）"),
      description:       z.string().optional().describe("明細ごとの摘要（省略可）"),
      allocationPercent: z.number().optional().describe("事業割合 0-100（省略時100）"),
    })).optional().describe("明細。渡すと既存の明細を全部置き換える。按分率だけ変える場合も全行を渡すこと"),
    isAdjusting: z.boolean().optional().describe("決算整理仕訳か（変更しないなら省略）"),
  },
  async ({ entryId, date, description, lines, isAdjusting }) => {
    const existing = db.prepare('SELECT id FROM "JournalEntry" WHERE id = ?').get(entryId);
    if (!existing) {
      return { content: [{ type: "text", text: `エラー: 仕訳 #${entryId} が見つかりません。` }], isError: true };
    }
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { content: [{ type: "text", text: "エラー: 日付は YYYY-MM-DD 形式で指定してください。" }], isError: true };
    }
    if (description !== undefined && !description.trim()) {
      return { content: [{ type: "text", text: "エラー: 摘要を空にはできません。" }], isError: true };
    }
    if (lines !== undefined) {
      if (lines.length < 2) {
        return { content: [{ type: "text", text: "エラー: 最低2行の明細が必要です。" }], isError: true };
      }
      const imbalance = validateBalance(lines);
      if (imbalance) {
        return { content: [{ type: "text", text: `エラー: ${imbalance}` }], isError: true };
      }
    }
    if (date === undefined && description === undefined && lines === undefined && isAdjusting === undefined) {
      return { content: [{ type: "text", text: "エラー: 変更する項目がありません。" }], isError: true };
    }

    try {
      // 解決はトランザクションの外でやる。科目名の誤りで途中まで書き換わるのを避けるため。
      const resolvedLines = lines !== undefined ? resolveLines(lines as LineInput[]) : null;

      const apply = db.transaction(() => {
        const before = snapshotEntry(entryId);

        if (date !== undefined) {
          db.prepare('UPDATE "JournalEntry" SET date = ? WHERE id = ?')
            .run(new Date(date).toISOString(), entryId);
        }
        if (description !== undefined) {
          db.prepare('UPDATE "JournalEntry" SET description = ? WHERE id = ?')
            .run(description.trim(), entryId);
        }
        if (isAdjusting !== undefined) {
          db.prepare('UPDATE "JournalEntry" SET isAdjusting = ? WHERE id = ?')
            .run(isAdjusting ? 1 : 0, entryId);
        }
        db.prepare(`UPDATE "JournalEntry" SET updatedAt = datetime('now') WHERE id = ?`).run(entryId);

        if (resolvedLines) {
          db.prepare('DELETE FROM "JournalLine" WHERE journalEntryId = ?').run(entryId);
          for (const l of resolvedLines) {
            db.prepare(
              `INSERT INTO "JournalLine"
                 (journalEntryId, accountId, subAccountId, debitAmount, creditAmount, description, allocationPercent)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(entryId, l.accountId, l.subAccountId, l.debitAmount, l.creditAmount, l.description, l.allocationPercent);
          }
        }

        const after = snapshotEntry(entryId);
        db.prepare(
          `INSERT INTO "JournalAuditLog" (journalEntryId, action, beforeData, afterData, changedAt)
           VALUES (?, 'update', ?, ?, datetime('now'))`
        ).run(entryId, JSON.stringify(before), JSON.stringify(after));

        return after;
      });

      const after = apply();
      const changed = [
        date !== undefined        ? `日付 → ${date}` : null,
        description !== undefined ? `摘要 → ${description}` : null,
        isAdjusting !== undefined ? `決算整理 → ${isAdjusting}` : null,
        resolvedLines             ? `明細を${resolvedLines.length}行に置換` : null,
      ].filter(Boolean).join(" / ");

      const body = resolvedLines
        ? formatLines(resolvedLines)
        : `摘要: ${after?.description ?? ""}`;

      return {
        content: [{
          type: "text",
          text: `✅ 仕訳 #${entryId} を訂正しました。\n\n変更: ${changed}\n${body}\n\n訂正前の内容は監査ログに保存されています。`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `エラー: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: 証憑の添付
// ─────────────────────────────────────────────────────────────────────────
server.tool(
  "attach_receipt",
  "領収書・請求書などの証憑ファイルを仕訳に添付する。ファイルは data/receipts にコピーされ、アプリからも参照できるようになる。",
  {
    entryId:      z.number().describe("添付先の仕訳ID"),
    filePath:     z.string().describe("添付するファイルの絶対パス（PDF・画像）"),
    originalName: z.string().optional().describe("保存名（省略時は元のファイル名）。後から探しやすい名前を付けると良い"),
  },
  async ({ entryId, filePath, originalName }) => {
    const entry = db.prepare('SELECT id, description FROM "JournalEntry" WHERE id = ?')
      .get(entryId) as { id: number; description: string } | undefined;
    if (!entry) {
      return { content: [{ type: "text", text: `エラー: 仕訳 #${entryId} が見つかりません。` }], isError: true };
    }
    if (!fs.existsSync(filePath)) {
      return { content: [{ type: "text", text: `エラー: ファイルが見つかりません: ${filePath}` }], isError: true };
    }
    if (!fs.statSync(filePath).isFile()) {
      return { content: [{ type: "text", text: `エラー: ディレクトリは添付できません: ${filePath}` }], isError: true };
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) {
      return {
        content: [{ type: "text", text: `エラー: 対応していない形式です(${ext || "拡張子なし"})。対応: ${Object.keys(MIME_BY_EXT).join(", ")}` }],
        isError: true,
      };
    }

    try {
      fs.mkdirSync(RECEIPT_DIR, { recursive: true });
      // アプリ側と同じ命名規則: {epoch_ms}_{ランダム}.{拡張子}
      const storedName = `${Date.now()}_${Math.random().toString(36).slice(2, 13)}${ext}`;
      const dest = path.join(RECEIPT_DIR, storedName);
      fs.copyFileSync(filePath, dest);
      const size = fs.statSync(dest).size;

      const result = db.prepare(
        `INSERT INTO "Receipt" (journalEntryId, filePath, originalName, mimeType, fileSize, uploadedAt)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).run(entryId, storedName, originalName ?? path.basename(filePath), mimeType, size);

      const count = db.prepare('SELECT COUNT(*) as n FROM "Receipt" WHERE journalEntryId = ?')
        .get(entryId) as { n: number };

      return {
        content: [{
          type: "text",
          text: [
            `✅ 証憑 #${result.lastInsertRowid} を仕訳 #${entryId} に添付しました。`,
            ``,
            `仕訳: ${entry.description}`,
            `保存名: ${originalName ?? path.basename(filePath)}`,
            `形式: ${mimeType} / ${(size / 1024).toFixed(1)} KB`,
            `この仕訳の証憑: ${count.n}件`,
          ].join("\n"),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `エラー: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// 起動
// ─────────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
