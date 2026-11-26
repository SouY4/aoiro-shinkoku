"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import PrintButton from "@/components/PrintButton";
import { formatNumber, toReiwa } from "@/lib/formatters";
import { calcLossHelper, formatForCopy, toCsv } from "@/lib/tax-return";
import type { BalanceRow, CheckResult, SheetRow, TaxReturnData } from "@/lib/tax-return";

const cardClass = "bg-white rounded-xl border border-gray-200 p-6 print:p-4";
const reportCardClass = `${cardClass} print:break-before-page`;
const headingClass = "mb-4 text-lg font-semibold";
const totalClass = "bg-blue-50 font-semibold";
const page1Totals = new Set(["④", "⑥", "⑦", "㉜", "㉝", "㊲", "㊷", "㊸", "㊺"]);
const blueIncomeRows = new Set(["⑥", "⑦"]);

function Amount({ value }: { value: number }) {
  return (
    <span className={value < 0 ? "text-red-700" : undefined}>
      {value < 0 && "△"}{formatNumber(Math.abs(value))}
    </span>
  );
}

function CopyButton({ label, amount }: { label: string; amount: number }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  async function copy() {
    if (timer.current !== null) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(formatForCopy(amount));
      if (timer.current !== null) clearTimeout(timer.current);
      setStatus("copied");
      timer.current = setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("failed");
    }
  }

  return (
    <button
      type="button"
      aria-label={`${label}をコピー`}
      className="no-print whitespace-nowrap rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-100"
      onClick={copy}
    >
      <span aria-live="polite">{status === "copied" ? "✓" : status === "failed" ? "失敗" : "コピー"}</span>
    </button>
  );
}

function ReportTable({ columns, children }: {
  columns: { label: string; align?: "right" | "center"; copy?: boolean }[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-sm [&_td]:px-2 [&_td]:py-2 [&_th]:px-2 [&_th]:py-2 print:[&_td]:py-0.5 print:[&_th]:py-0.5">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {columns.map(({ label, align, copy }, index) => (
              <th
                key={index}
                scope="col"
                className={`whitespace-nowrap font-medium ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${copy ? "no-print" : ""}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

function AmountCell({ value }: { value: number | null }) {
  return (
    <td className="whitespace-nowrap text-right tabular-nums">
      {value === null ? "—" : <Amount value={value} />}
    </td>
  );
}

function CopyCell({ label, amount }: { label: string; amount: number }) {
  return (
    <td className="no-print text-center">
      <CopyButton label={label} amount={amount} />
    </td>
  );
}

function NumberedTable({ rows, hideZero, totals }: { rows: SheetRow[]; hideZero: boolean; totals: Set<string> }) {
  return (
    <ReportTable columns={[
      { label: "番号" },
      { label: "項目" },
      { label: "金額", align: "right" },
      { label: "コピー", align: "center", copy: true },
    ]}>
      <tbody className="divide-y divide-gray-100">
        {rows.filter((row) => !hideZero || row.amount !== 0 || totals.has(row.no)).map((row) => (
          <tr key={row.no} className={totals.has(row.no) ? totalClass : undefined}>
            <td>{row.no}</td>
            <td>
              {row.label}
              {row.note && <p className="text-xs font-normal text-gray-600">{row.note}</p>}
            </td>
            <AmountCell value={row.amount} />
            <CopyCell label={row.label} amount={row.amount} />
          </tr>
        ))}
      </tbody>
    </ReportTable>
  );
}

const checkStyles = {
  ok: { symbol: "✓", label: "一致", className: "text-green-700" },
  error: { symbol: "✕", label: "エラー", className: "text-red-700" },
  warn: { symbol: "!", label: "注意", className: "text-amber-700" },
};

function ChecksCard({ checks, isYearOver }: { checks: CheckResult[]; isYearOver: boolean }) {
  const hasError = checks.some(({ level }) => level === "error");
  const warningCount = checks.filter(({ level }) => level === "warn").length;

  return (
    <section className={`bg-white rounded-xl border p-6 ${hasError ? "border-red-500" : "border-gray-200"}`}>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">チェック</h2>
        {hasError ? (
          <p className="text-sm font-medium text-red-700">転記する前に直してください</p>
        ) : (
          <>
            <p className="text-sm font-medium text-green-700">{isYearOver ? "このまま転記できます" : "計算は合っています(年の途中)"}</p>
            {warningCount > 0 && <p className="text-sm text-amber-700">注意が{warningCount}件あります</p>}
          </>
        )}
      </div>
      <ul className="divide-y divide-gray-100 text-sm">
        {checks.map(({ level, title, detail }) => {
          const style = checkStyles[level];
          return (
            <li key={title} className="flex items-baseline gap-2 py-2">
              <span className={`w-4 shrink-0 text-center font-semibold ${style.className}`}>
                <span className="sr-only">{style.label}</span>
                <span aria-hidden="true">{style.symbol}</span>
              </span>
              <span>
                <span className="font-medium">{title}</span>
                <span className="ml-2 text-gray-600">{detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MonthlyTable({ data, hideZero }: { data: TaxReturnData; hideZero: boolean }) {
  return (
    <ReportTable columns={[
      { label: "月" },
      { label: "売上", align: "right" },
      { label: "コピー", align: "center", copy: true },
      { label: "仕入", align: "right" },
      { label: "コピー", align: "center", copy: true },
    ]}>
      <tbody className="divide-y divide-gray-100">
        {data.monthly.filter(({ sales, purchases }) => !hideZero || sales !== 0 || purchases !== 0).map((row) => (
          <tr key={row.month}>
            <td>{row.month}月</td>
            <AmountCell value={row.sales} />
            <CopyCell label={`${row.month}月の売上`} amount={row.sales} />
            <AmountCell value={row.purchases} />
            <CopyCell label={`${row.month}月の仕入`} amount={row.purchases} />
          </tr>
        ))}
        {[
          { label: "家事消費等", amount: data.homeConsumption },
          { label: "雑収入", amount: data.miscIncome },
        ].filter(({ amount }) => !hideZero || amount !== 0).map(({ label, amount }) => (
          <tr key={label}>
            <td>{label}</td>
            <AmountCell value={amount} />
            <CopyCell label={label} amount={amount} />
            <AmountCell value={null} />
            <td className="no-print" />
          </tr>
        ))}
      </tbody>
      <tfoot className="print:table-row-group">
        <tr className={totalClass}>
          <th scope="row" className="text-left">計</th>
          <AmountCell value={data.salesTotal} />
          <CopyCell label="売上の計" amount={data.salesTotal} />
          <AmountCell value={data.purchasesTotal} />
          <CopyCell label="仕入の計" amount={data.purchasesTotal} />
        </tr>
      </tfoot>
    </ReportTable>
  );
}

function RentTable({ rent, hideZero }: { rent: TaxReturnData["rent"]; hideZero: boolean }) {
  const rows = [
    { label: "本年中の賃借料", amount: rent.total },
    { label: "左の賃借料のうち必要経費算入額", amount: rent.business },
  ].filter(({ amount }) => !hideZero || amount !== 0);

  return (
    <ReportTable columns={[
      { label: "項目" },
      { label: "金額", align: "right" },
      { label: "コピー", align: "center", copy: true },
    ]}>
      <tbody className="divide-y divide-gray-100">
        {rows.map(({ label, amount }) => (
          <tr key={label}>
            <td>{label}</td>
            <AmountCell value={amount} />
            <CopyCell label={label} amount={amount} />
          </tr>
        ))}
      </tbody>
    </ReportTable>
  );
}

function DepreciationTable({ rows, hideZero }: { rows: TaxReturnData["depreciation"]; hideZero: boolean }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-600">固定資産はありません。記入は不要です。</p>;
  }
  const visibleRows = rows.filter(({ cost, yearAmount, endBookValue }) =>
    !hideZero || cost !== 0 || yearAmount !== 0 || endBookValue !== 0,
  );

  return (
    <ReportTable columns={[
      { label: "資産名" },
      { label: "取得年月" },
      { label: "取得価額", align: "right" },
      { label: "耐用年数", align: "right" },
      { label: "償却率", align: "right" },
      { label: "本年中の償却期間", align: "right" },
      { label: "本年分の償却費", align: "right" },
      { label: "未償却残高", align: "right" },
      { label: "仕訳", align: "center" },
    ]}>
      <tbody className="divide-y divide-gray-100">
        {visibleRows.map((row, index) => (
          <tr key={index}>
            <td>{row.name}</td>
            <td className="whitespace-nowrap">{row.acquisitionYearMonth}</td>
            <AmountCell value={row.cost} />
            <td className="whitespace-nowrap text-right">{row.usefulLifeYears}年</td>
            <td className="whitespace-nowrap text-right">{(row.rateMilli / 1000).toFixed(3)}</td>
            <td className="whitespace-nowrap text-right">{row.months}/12</td>
            <AmountCell value={row.yearAmount} />
            <AmountCell value={row.endBookValue} />
            <td className="whitespace-nowrap text-center">
              {row.alreadyRecorded ? "済" : row.yearAmount > 0 ? <span className="text-amber-700">未</span> : "—"}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="print:table-row-group">
        <tr className={totalClass}>
          <th colSpan={6} scope="row" className="text-left">合計</th>
          <AmountCell value={rows.reduce((sum, row) => sum + row.yearAmount, 0)} />
          <td colSpan={2} />
        </tr>
      </tfoot>
    </ReportTable>
  );
}

function BalanceTable({ title, rows, total, hideZero }: {
  title: string;
  rows: BalanceRow[];
  total: TaxReturnData["assetTotal"];
  hideZero: boolean;
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ReportTable columns={[
        { label: "科目" },
        { label: "期首", align: "right" },
        { label: "期末", align: "right" },
        { label: "コピー", align: "center", copy: true },
      ]}>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, index) => {
            const isIncome = row.label === "青色申告特別控除前の所得金額" && row.opening === null;
            if (hideZero && (row.opening ?? 0) === 0 && row.closing === 0 && !isIncome) return null;
            return (
              <tr key={index}>
                <td>{row.label}</td>
                <AmountCell value={row.opening} />
                <AmountCell value={row.closing} />
                <CopyCell label={row.label} amount={row.closing} />
              </tr>
            );
          })}
        </tbody>
        <tfoot className="print:table-row-group">
          <tr className={totalClass}>
            <th scope="row" className="text-left">合計</th>
            <AmountCell value={total.opening} />
            <AmountCell value={total.closing} />
            <CopyCell label={`${title}の合計`} amount={total.closing} />
          </tr>
        </tfoot>
      </ReportTable>
    </div>
  );
}

function LossHelper({ businessIncome }: { businessIncome: number }) {
  const [salary, setSalary] = useState("");
  const salaryIncome = Number(salary.replaceAll(",", ""));
  const entered = /[0-9]/.test(salary);
  const loss = calcLossHelper({ businessIncome, salaryIncome });

  return (
    <section className={`${cardClass} print:break-inside-avoid`}>
      <h2 className={headingClass}>第四表(損失申告)の補助</h2>
      <p className="mb-4 text-sm text-gray-600">
        給与と事業だけの人向けの簡易計算です。ほかの所得や過年度の繰越損失がある場合は使えません。
      </p>
      <label className="no-print mb-4 block text-sm">
        給与所得控除後の給与等の金額(源泉徴収票)
        <input
          className="mt-1 block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 tabular-nums"
          type="text"
          inputMode="numeric"
          value={salary}
          onChange={(event) => {
            const value = event.target.value;
            if (/^[0-9,]*$/.test(value) && Number.isSafeInteger(Number(value.replaceAll(",", "")))) {
              setSalary(value);
            }
          }}
        />
      </label>
      <dl className="divide-y divide-gray-100 text-sm">
        {[
          { label: "事業所得㊺", amount: businessIncome },
          { label: "給与所得", amount: entered ? salaryIncome : null },
          { label: "通算後の金額", amount: entered ? loss.combined : null },
          { label: "翌年へ繰り越す損失", amount: entered ? loss.carryForward : null },
        ].map(({ label, amount }) => (
          <div key={label} className="flex justify-between gap-2 py-2">
            <dt>{label}</dt>
            <dd className="tabular-nums">{amount === null ? "—" : <Amount value={amount} />}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-2 py-2 font-semibold">
          <dt>第四表が必要か</dt>
          <dd>{!entered ? "給与所得を入力してください(給与がなければ0)" : loss.needsForm4 ? "必要" : "不要"}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function TaxReturnSheet({ data, isYearOver }: { data: TaxReturnData; isYearOver: boolean }) {
  const [hideZero, setHideZero] = useState(false);

  function saveCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `青色申告決算書_${data.fiscalYear}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold">申告転記シート</h1>
          <p className="text-sm text-gray-600">{toReiwa(data.fiscalYear)}分 青色申告決算書(一般用)への転記用</p>
        </div>
        <div className="no-print flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            onClick={saveCsv}
          >
            CSV保存
          </button>
          <PrintButton />
        </div>
      </header>

      {!isYearOver && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {data.fiscalYear}年はまだ終わっていません。12月31日までの仕訳を入れてから転記してください。
        </p>
      )}

      <ChecksCard checks={data.checks} isYearOver={isYearOver} />

      <label className="no-print flex w-fit items-center gap-2 text-sm">
        <input type="checkbox" checked={hideZero} onChange={(event) => setHideZero(event.target.checked)} />
        0円の行を隠す
      </label>

      <section className={reportCardClass}>
        <h2 className={headingClass}>1ページ 損益計算書</h2>
        <NumberedTable rows={data.page1} hideZero={hideZero} totals={page1Totals} />
      </section>

      <section className={reportCardClass}>
        <h2 className={headingClass}>2ページ 月別売上・仕入 / 地代家賃 / 青色申告特別控除</h2>
        <MonthlyTable data={data} hideZero={hideZero} />
        <h3 className="mb-2 mt-6 text-sm font-semibold">地代家賃</h3>
        <RentTable rent={data.rent} hideZero={hideZero} />
        <p className="mt-2 text-sm text-gray-600">支払先の住所・氏名と賃借物件は、作成コーナーで入力してください</p>
        <h3 className="mb-2 mt-6 text-sm font-semibold">青色申告特別控除額の計算</h3>
        <NumberedTable rows={data.blueDeduction} hideZero={hideZero} totals={blueIncomeRows} />
      </section>

      <section className={reportCardClass}>
        <h2 className={headingClass}>3ページ 減価償却費の計算</h2>
        <DepreciationTable rows={data.depreciation} hideZero={hideZero} />
      </section>

      <section className={reportCardClass}>
        <h2 className={headingClass}>4ページ 貸借対照表</h2>
        <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2">
          <BalanceTable title="資産" rows={data.assets} total={data.assetTotal} hideZero={hideZero} />
          <BalanceTable title="負債・資本" rows={data.liabilities} total={data.liabilityTotal} hideZero={hideZero} />
        </div>
      </section>

      <LossHelper businessIncome={data.income} />

      <section className={`${cardClass} print:break-inside-avoid`}>
        <h2 className={headingClass}>第一表へ転記する数字</h2>
        <dl className="divide-y divide-gray-100 text-sm">
          {[
            { label: "収入金額等・事業(営業等)", amount: data.page1[0].amount },
            { label: "所得金額等・事業(営業等)", amount: data.income },
          ].map(({ label, amount }) => (
            <div key={label} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <dt>{label}</dt>
              <dd className="flex items-center gap-3 font-semibold tabular-nums">
                <Amount value={amount} />
                <CopyButton label={label} amount={amount} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
