# Stripe CSV 取込 → 月次手数料の自動仕訳（設計）

作成日: 2026-05-22

## 目的

Stripe の `balance_history.csv` をアプリに渡すと、その月の **Stripe 決済手数料を集計して仕訳を自動生成**する。
プラットフォーム手数料（platform_fee）は現在 0 円のため、事業として実際に発生している費用は Stripe の決済手数料（支払手数料）のみ。出品者預り・送金・チャージ等の現預金フローは本機能の対象外とし、期末に手動で調整する。

## スコープ（最小版）

- 対象 Type: `charge`（Fee 列）と `stripe_fee`（Net の絶対値）のみ。
- それ以外の Type（`transfer` / `topup` / `reserve_transaction` / `adjustment` / `application_fee`）は集計しない。プレビューで「対象外」として件数のみ表示し、無視していることを明示する。
- 生成するのは「1 ヶ月 = 1 仕訳」の月次一括仕訳。

## 生成する仕訳

```
日付   : その月の末日（例 2026-05-31）
摘要   : 「2026年5月 Stripe決済手数料」
借方   支払手数料                ●●●円
  貸方   その他の預金〔Stripe残高〕  ●●●円
```

- 借方科目: `支払手数料`（code 6019）。既定値。取込画面で変更可。
- 貸方科目: `その他の預金`（code 1004） / 補助科目 `Stripe残高`。取込画面で選択。
- 金額 ●●● = その月の `charge` 行の Fee 合計 ＋ `stripe_fee` 行の Net 絶対値合計。

## 解析ロジック（`src/lib/stripe-csv.ts`）

- 依存追加なし。引用符対応の小さな CSV パーサを自作する（フィールド内カンマ・改行に備える）。
- ヘッダ行から列インデックスを解決（`Type` / `Amount` / `Fee` / `Net` / `Created (UTC)`）。列順や追加メタデータ列に依存しない。
- 月の決定: `Created (UTC)` を **JST（+9h）に変換**して年・月を取る。手数料は発生日基準が自然なため `Available On` ではなく `Created` を採用。
- 月ごとの集計:
  - `charge` 行: `Fee` 列を加算。
  - `stripe_fee` 行: `Net` の絶対値を加算。
  - 合計を「その月の支払手数料」とする。
- 出力: `{ year, month, chargeFeeTotal, stripeFeeTotal, total, chargeCount, stripeFeeCount, ignoredCount }[]` を月昇順で返す純粋関数。副作用なし・単体テスト可能。

## 重複防止

- 取込前に「同月・同摘要（`YYYY年M月 Stripe決済手数料`）」の既存 `JournalEntry` を検索。
- 見つかった月は状態を「登録済み」とし、既定でチェックを外す。登録は行わない（上書きしない）。
- これにより同じ CSV を二度取り込んでも二重計上しない。

## 設定の永続化

- 取込画面で選んだ「借方科目・貸方科目・補助科目」を `Setting`（key: `stripeImportConfig`、値は JSON）に保存し、次回の既定値にする。
- 既定: 借方=支払手数料(6019)、貸方=その他の預金(1004)/補助科目=Stripe残高。

## UI / 画面遷移

- 新規ページ `/journal/import-stripe`。ナビ（`src/app/layout.tsx`）の「仕訳帳」の下に「Stripe取込」を追加。
- 流れ:
  1. ファイル選択（CSV を読み込み、クライアントで解析）。
  2. 解析結果テーブル: 月 ｜ charge手数料 ｜ stripe_fee ｜ 合計 ｜ 状態（新規 / 登録済み）。対象外件数も表示。
  3. 取り込む月にチェック（既定で「新規」のみ ON）。
  4. 借方・貸方科目を確認・変更（補助科目を含む）。
  5. 「選択した月を登録」→ 月ごとに既存の `createJournalEntry` を呼ぶ。
- 登録後は結果（成功件数・スキップ件数）を表示し、`/journal` へ誘導。

## コンポーネント構成と責務

- `src/lib/stripe-csv.ts`: CSV パース＋月次集計の純粋ロジック。DB に依存しない。
- `src/actions/stripe-import-actions.ts`: Server Action。
  - `getStripeImportConfig()` / `saveStripeImportConfig()`（Setting の読み書き）。
  - `findExistingFeeEntries(months)`: 同月・同摘要の既存仕訳の有無を返す（重複判定）。
  - `importStripeFees(selectedMonths, config)`: 選択月ごとに `createJournalEntry` を呼ぶ。結果サマリを返す。
- `src/app/journal/import-stripe/page.tsx`: サーバーコンポーネント（科目一覧・設定の取得）。
- `src/components/journal/StripeImportClient.tsx`: クライアント。ファイル読込・解析・プレビュー・科目選択・登録実行。

## エラー処理

- CSV パース失敗（ヘッダ列が見つからない等）: 画面にエラー表示。登録は行わない。
- 集計合計が 0 円の月: 仕訳を作らない（チェック対象外）。
- `createJournalEntry` のバリデーション（貸借一致・2 行以上）は既存実装をそのまま利用。

## テスト方針

- `src/lib/stripe-csv.ts` を単体テスト:
  - サンプル CSV（4月・5月・3月・2月混在）で各月の合計が正しいこと。
  - `charge` の Fee と `stripe_fee` の Net 絶対値のみが加算されること。
  - 対象外 Type が無視されること。
  - UTC→JST 変換で月境界が正しく扱われること。
- Server Action は重複判定（登録済み月のスキップ）を確認。

## 非対象（YAGNI）

- 出品者預り（預り金 / 売掛金）の自動仕訳（期末に手動）。
- 入金・送金・チャージの現預金フロー仕訳。
- platform_fee を売上計上する処理（現在 0 円）。
- MCP ツール化（今回はアプリ内 UI のみ）。
