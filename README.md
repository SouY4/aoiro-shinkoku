# 青色申告アプリ — AoiroShinkoku

**「アプリは作れるけど、簿記は分からない」個人事業主のための青色申告デスクトップアプリ**

> このリポジトリは、Zenn Book「**プログラマーのための青色申告・簿記入門**」の実習用アプリです。
> 帳簿の仕組みを理解しながら、実際の確定申告に使えるアプリを手元で動かすことができます。

---

## 主な機能

| 機能 | 説明 |
|------|------|
| **仕訳入力** | サブスク・源泉徴収ありのショートカットテンプレート付き |
| **仕訳検索** | 日付・金額範囲・科目・摘要の複合検索（優良電子帳簿要件対応） |
| **損益計算書** | 青色申告決算書2ページ目の月別売上集計付き |
| **貸借対照表** | 通常表示 / 決算書用（事業主貸△表示）の切替 |
| **固定資産台帳** | 定額法で自動計算、決算書3ページ目フォーマットで表示 |
| **棚卸表** | 期末棚卸高を入力して仕訳を自動生成 |
| **仕訳変更履歴** | 訂正・削除の履歴を保存・閲覧（優良電子帳簿要件対応） |
| **書類管理** | 請求書・見積書・納品書の作成 |
| **年度繰越** | 事業主借・貸を元入金へ自動振替、翌年度へ移行 |
| **バックアップ** | SQLiteファイルを日付付きでローカルに保存（7年保存義務対応） |
| **収入シミュレーター** | 103万・130万円の壁などをリアルタイム表示 |

### 優良電子帳簿要件への対応（青色申告65万円 → 75万円控除）

- ✅ 訂正・削除の履歴保存（作成・訂正・削除を日時付きで記録）
- ✅ 日付・金額の範囲指定検索
- ✅ 2項目以上の複合検索（日付 × 金額 × 科目 × 摘要）
- ✅ 帳簿間の相互関連性（仕訳帳 ↔ 総勘定元帳）
- ✅ 見読可能性（画面表示・印刷）

---

## Zenn Book との対応

このアプリは以下のZenn Bookと合わせて使うことを想定しています。

> **📘 プログラマーのための青色申告・簿記入門**
> https://zenn.dev/souya/books/47c148f2d2dc64 

| Book の章 | アプリの対応機能 |
|----------|----------------|
| 第1〜4章（簿記の基礎） | 勘定科目マスタ、仕訳入力フォーム |
| 第5〜9章（期中の仕訳） | サブスクテンプレート、家事按分、源泉徴収テンプレート |
| 第10〜12章（決算） | 減価償却、棚卸表 |
| 第13〜15章（財務諸表） | 損益計算書、貸借対照表（決算書用表示） |
| 第16章（確定申告） | 月別売上集計、固定資産台帳（決算書フォーマット） |
| 第17章（記録保存） | 仕訳変更履歴、バックアップ機能 |
| 第18〜20章（検証・ミス・税務調査） | 年度繰越、自己チェックリスト |

---

## ダウンロード（ビルド済みインストーラー）

Node.js 不要。インストーラーをダウンロードしてそのまま使えます。

| OS | ダウンロード |
|----|------------|
| Windows (x64) | [AoiroShinkoku-Setup.exe](https://github.com/SouY4/aoiro-shinkoku/releases/latest/download/AoiroShinkoku-Setup.exe) |
| Mac (Apple Silicon / M1〜) | [AoiroShinkoku-arm64.dmg](https://github.com/SouY4/aoiro-shinkoku/releases/latest/download/AoiroShinkoku-arm64.dmg) |
| Mac (Intel) | [AoiroShinkoku-x64.dmg](https://github.com/SouY4/aoiro-shinkoku/releases/latest/download/AoiroShinkoku-x64.dmg) |

> **Windows：初回起動時の警告について**
> 「Windows によって PC が保護されました」と表示されたら「詳細情報 → 実行」をクリック

> **Mac：初回起動時の警告について**
> 「開発元を確認できません」と表示されたら、Finder でアプリを右クリック →「開く」→「開く」をクリック

---

## セットアップ

### 動作環境

- Node.js 20 以上
- pnpm 9 以上

### インストール

```bash
git clone https://github.com/SouY4/aoiro-shinkoku.git
cd aoiro-shinkoku
pnpm install
```

### DBの初期化

```bash
pnpm prisma migrate dev
pnpm prisma db seed
```

### 開発サーバー起動（ブラウザで確認）

```bash
pnpm dev
```

`http://localhost:3000` を開きます。

### デスクトップアプリとして起動（Electron）

```bash
pnpm run electron:dev
```

### インストーラー（.exe）をビルド

```bash
pnpm run electron:build
```

`dist/` に `.exe` が生成されます。フォルダのみのビルドは `pnpm run electron:pack`。

> **初回のみ**: `electron` と `electron-builder` のダウンロードで数分かかります。
> `Ignored build scripts: electron` と表示された場合は `node node_modules/electron/install.js` を先に実行してください。

---

## Claude との連携（MCP）

MCP（Model Context Protocol）を使うと、Claude Desktop や Claude Code から日本語で帳簿を操作できます。
**ZIP ダウンロードだけでも使えます**（git clone は不要）。

### できること

```
「3月の通信費の仕訳を見せて」
「AWSに3,500円払ったレシートの仕訳を提案して」
「2025年の損益計算書を出して」
「月別売上を表示して」
```

### 前提

- Node.js 20 以上 + pnpm 9 以上がインストール済み
- [セットアップ](#セットアップ) が完了している（DB初期化まで）

---

どちらも ZIP ダウンロードで使えます（GitHub アカウント不要）。

---

### パターン A：Claude Desktop で使う

1. Claude Desktop を開く
2. **Settings → Developer → Edit Config** をクリック
3. 開いた `claude_desktop_config.json` に以下を貼り付けて保存

**Windows：**

```json
{
  "mcpServers": {
    "aoiro-shinkoku": {
      "command": "C:\\Users\\<ユーザー名>\\AppData\\Local\\pnpm\\pnpm.cmd",
      "args": ["run", "mcp"],
      "cwd": "C:\\Users\\<ユーザー名>\\Downloads\\AoiroShinkoku",
      "env": {
        "DATABASE_URL": "file:C:\\Users\\<ユーザー名>\\AppData\\Roaming\\AoiroShinkoku\\database.sqlite"
      }
    }
  }
}
```

> `pnpm.cmd` のパスは PowerShell で `(Get-Command pnpm).Source` を実行して確認してください。

**Mac：**

```json
{
  "mcpServers": {
    "aoiro-shinkoku": {
      "command": "/opt/homebrew/bin/pnpm",
      "args": ["run", "mcp"],
      "cwd": "/Users/<ユーザー名>/Downloads/AoiroShinkoku",
      "env": {
        "DATABASE_URL": "file:/Users/<ユーザー名>/Library/Application Support/AoiroShinkoku/database.sqlite"
      }
    }
  }
}
```

> `pnpm` のパスは Terminal で `which pnpm` を実行して確認してください。

4. Claude Desktop を**完全に再起動**（ウィンドウを閉じるだけでなく、タスクトレイ / メニューバーのアイコンからも終了）

---

### パターン B：MCP 対応の開発ツールで使う（Claude Code / Cursor / Codex 等）

プロジェクトルートに `.mcp.json` を作成するだけで、MCP 対応ツールなら何でも使えます。

**Windows の例：**

```json
{
  "mcpServers": {
    "aoiro-shinkoku": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["run", "mcp"],
      "cwd": "C:\\Users\\<ユーザー名>\\Downloads\\AoiroShinkoku",
      "env": {
        "DATABASE_URL": "file:C:\\Users\\<ユーザー名>\\AppData\\Roaming\\AoiroShinkoku\\database.sqlite"
      }
    }
  }
}
```

**Mac の例：**

```json
{
  "mcpServers": {
    "aoiro-shinkoku": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["run", "mcp"],
      "cwd": "/Users/<ユーザー名>/Downloads/AoiroShinkoku",
      "env": {
        "DATABASE_URL": "file:/Users/<ユーザー名>/Library/Application Support/AoiroShinkoku/database.sqlite"
      }
    }
  }
}
```

> `.mcp.json` はローカルパスが含まれるため `.gitignore` 済みです。各自の環境に合わせて作成してください。

---

### 利用できるツール

| ツール | 説明 |
|--------|------|
| `list_accounts` | 勘定科目の一覧を取得 |
| `search_entries` | 日付・金額・科目名・摘要で仕訳を検索 |
| `get_income_statement` | 指定年度の損益計算書を表示 |
| `get_monthly_sales` | 月別売上集計を表示（決算書2ページ目用） |
| `suggest_journal_entry` | 支払い内容と金額から仕訳を提案 |
| `create_journal_entry` | 仕訳を帳簿に登録 |

---

## ディレクトリ構成

```
aoiro-shinkoku/
├── src/
│   ├── app/            # ページ（仕訳帳・元帳・レポート・設定）
│   ├── actions/        # Server Actions
│   ├── components/     # UIコンポーネント
│   └── lib/            # 計算ロジック（減価償却・税額計算 等）
├── prisma/
│   ├── schema.prisma   # DBスキーマ
│   ├── migrations/     # マイグレーション履歴
│   ├── seed.js         # 初期勘定科目データ
│   └── data/           # SQLiteファイル（.gitignore済み・個人データ）

```

---

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS + Lucide React
- **DB**: SQLite（Prisma ORM）
- **デスクトップ**: Electron

---

## ライセンス

GPL-3.0

改変・再配布する場合はソースコードの公開が必要です。

---

## 注意事項

- このアプリは個人利用・学習目的で作成されています
- 申告内容の正確性は必ずご自身または税理士にご確認ください
- データはローカルにのみ保存されます（外部サーバーへの送信なし）
