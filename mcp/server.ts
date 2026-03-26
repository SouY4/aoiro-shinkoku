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

// ── DB接続 ────────────────────────────────────────────────────────────────
const DB_PATH = path.join(process.cwd(), "prisma", "data", "database.sqlite");
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
    debitCode: "6007", creditCode: "3001", label: "旅費交通費" },
  { patterns: ["ガソリン", "駐車"],
    debitCode: "6006", creditCode: "3001", label: "車両費" },
  { patterns: ["会議", "打ち合わせ", "ミーティング", "カフェ", "コーヒー"],
    debitCode: "6008", creditCode: "3001", label: "会議費" },
  { patterns: ["電気", "ガス", "水道"],
    debitCode: "6003", creditCode: "3001", label: "水道光熱費（按分要確認）" },
  { patterns: ["携帯", "スマホ", "docomo", "au", "softbank", "rakuten mobile"],
    debitCode: "6005", creditCode: "3001", label: "通信費（携帯）" },
  { patterns: ["インターネット", "光", "wifi", "nuro", "ntt"],
    debitCode: "6005", creditCode: "3001", label: "通信費（ネット）" },
  { patterns: ["文具", "コンビニ", "100均", "ダイソー", "usb", "hdmi", "ケーブル"],
    debitCode: "6010", creditCode: "3001", label: "消耗品費" },
  { patterns: ["セミナー", "勉強会", "研修", "講座", "udemy", "connpass"],
    debitCode: "6009", creditCode: "3001", label: "研修費" },
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
      debitAmount:       z.number().describe("借方金額（貸方のときは0）"),
      creditAmount:      z.number().describe("貸方金額（借方のときは0）"),
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

    const totalDebit  = lines.reduce((s: number, l: { debitAmount: number }) => s + (l.debitAmount ?? 0), 0);
    const totalCredit = lines.reduce((s: number, l: { creditAmount: number }) => s + (l.creditAmount ?? 0), 0);
    if (totalDebit !== totalCredit) {
      return {
        content: [{ type: "text", text: `エラー: 借方合計(¥${totalDebit.toLocaleString()}) ≠ 貸方合計(¥${totalCredit.toLocaleString()})` }],
        isError: true,
      };
    }

    // 科目ID解決
    type LineInput = { accountCode: string; debitAmount: number; creditAmount: number; allocationPercent?: number };
    const resolvedLines = (lines as LineInput[]).map((l) => {
      const account = getAccountByCode(l.accountCode);
      if (!account) throw new Error(`科目コード "${l.accountCode}" が見つかりません。list_accounts で確認してください。`);
      return { accountId: account.id, accountName: account.name, debitAmount: l.debitAmount, creditAmount: l.creditAmount, allocationPercent: l.allocationPercent ?? 100 };
    });

    // トランザクション挿入
    const insert = db.transaction(() => {
      const entryResult = db.prepare(
        `INSERT INTO "JournalEntry" (date, description, isAdjusting, createdAt, updatedAt)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      ).run(new Date(date).toISOString(), description.trim(), isAdjusting ? 1 : 0);

      const entryId = entryResult.lastInsertRowid as number;

      for (const l of resolvedLines) {
        db.prepare(
          `INSERT INTO "JournalLine" (journalEntryId, accountId, debitAmount, creditAmount, allocationPercent)
           VALUES (?, ?, ?, ?, ?)`
        ).run(entryId, l.accountId, l.debitAmount, l.creditAmount, l.allocationPercent);
      }

      // 監査ログ
      db.prepare(
        `INSERT INTO "JournalAuditLog" (journalEntryId, action, afterData, changedAt)
         VALUES (?, 'create', ?, datetime('now'))`
      ).run(entryId, JSON.stringify({ description, date, lines: resolvedLines }));

      return entryId;
    });

    try {
      const entryId = insert();
      const summary = resolvedLines
        .map((l) => l.debitAmount > 0
          ? `  借: ${l.accountName} ¥${l.debitAmount.toLocaleString()}`
          : `  貸: ${l.accountName} ¥${l.creditAmount.toLocaleString()}`)
        .join("\n");

      return {
        content: [{
          type: "text",
          text: `✅ 仕訳 #${entryId} を作成しました。\n\n日付: ${date}\n摘要: ${description}\n${summary}`,
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
