"use client";

import { useState, useMemo } from "react";
import {
  calculateOptimizer,
  calculateComparison,
  type OptimizerInput,
  type OptimizerResult,
  type ComparisonResult,
} from "@/lib/optimizer-calculator";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, ReferenceLine, ReferenceDot,
} from "recharts";

function formatYen(value: number): string {
  if (value === 0) return "0円";
  const abs = Math.abs(value);
  if (abs >= 10_000) {
    const man = (abs / 10_000).toFixed(abs % 10_000 === 0 ? 0 : 1);
    return `${value < 0 ? "-" : ""}${man}万円`;
  }
  return `${value < 0 ? "-" : ""}${abs.toLocaleString()}円`;
}

function formatYenExact(value: number): string {
  return `${value < 0 ? "-" : ""}${Math.abs(value).toLocaleString()}円`;
}

const NATIONAL_PENSION_DISPLAY = 210_120;

interface Props {
  initialSalaryRevenue: number;
  initialBusinessRevenue: number;
  initialBusinessExpenses: number;
  initialProportionalExpenses: number;
}

export default function OptimizerSection({
  initialSalaryRevenue,
  initialBusinessRevenue,
  initialBusinessExpenses,
  initialProportionalExpenses,
}: Props) {
  const [useExisting, setUseExisting] = useState(true);

  // 万円単位で入力
  const [salaryMan, setSalaryMan] = useState(Math.round(initialSalaryRevenue / 10_000));
  const [revenueMan, setRevenueMan] = useState(Math.round(initialBusinessRevenue / 10_000));
  const [expensesMan, setExpensesMan] = useState(Math.round((initialBusinessExpenses - initialProportionalExpenses) / 10_000));
  const [proportionalMan, setProportionalMan] = useState(Math.round(initialProportionalExpenses / 10_000));
  const [payPension, setPayPension] = useState(true);

  // 既存値(万円)
  const existingSalaryMan = Math.round(initialSalaryRevenue / 10_000);
  const existingRevenueMan = Math.round(initialBusinessRevenue / 10_000);
  const existingExpensesMan = Math.round((initialBusinessExpenses - initialProportionalExpenses) / 10_000);
  const existingProportionalMan = Math.round(initialProportionalExpenses / 10_000);

  const input: OptimizerInput = useMemo(() => ({
    salaryRevenue: (useExisting ? existingSalaryMan : salaryMan) * 10_000,
    businessRevenue: (useExisting ? existingRevenueMan : revenueMan) * 10_000,
    expenses: (useExisting ? existingExpensesMan : expensesMan) * 10_000,
    proportionalExpenses: (useExisting ? existingProportionalMan : proportionalMan) * 10_000,
    payNationalPension: payPension,
  }), [useExisting, salaryMan, revenueMan, expensesMan, proportionalMan, payPension, existingSalaryMan, existingRevenueMan, existingExpensesMan, existingProportionalMan]);

  const comparison = useMemo(() => calculateComparison(input), [input]);
  const r = comparison.current;

  // 警告メッセージ
  const warnings: string[] = [];
  if (!r.isDependant) {
    warnings.push(`⚠️ 社会保険の扶養から外れます。国保が年間約${formatYen(r.nhi)}発生します`);
  }
  if (!r.isWorkingStudentEligible) {
    warnings.push("⚠️ 勤労学生控除が使えなくなります。親の控除も減額されます");
  }
  if (r.totalIncome > 1_230_000) {
    warnings.push("⚠️ 親の特定親族特別控除がゼロになります");
  }
  if (r.isDependant && !comparison.increased.isDependant && comparison.cashDiff < 0) {
    const breakEven = comparison.breakEvenRevenue;
    const msg = breakEven
      ? `⚠️ 働き損ゾーンです。扶養内に収めるか、売上を${formatYen(breakEven)}以上に増やした方が得です`
      : "⚠️ 売上を少し増やすと働き損になる可能性があります";
    warnings.push(msg);
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-xl font-bold">学生フリーランス 扶養内最適化シミュレーター</h2>
        <p className="text-indigo-100 text-sm mt-1">2026年分（令和8年分）対応</p>
      </div>

      {/* 入力エリア */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">入力</h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={useExisting}
              onChange={(e) => {
                setUseExisting(e.target.checked);
                if (e.target.checked) {
                  setSalaryMan(existingSalaryMan);
                  setRevenueMan(existingRevenueMan);
                  setExpensesMan(existingExpensesMan);
                  setProportionalMan(existingProportionalMan);
                }
              }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-gray-700">帳簿の値を使用</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SliderInput
            label="給与収入（バイト）"
            value={useExisting ? existingSalaryMan : salaryMan}
            onChange={setSalaryMan}
            max={300}
            disabled={useExisting}
            hint="アルバイト等の年間額面収入"
            exactValue={useExisting ? initialSalaryRevenue : undefined}
          />
          <SliderInput
            label="事業の売上"
            value={useExisting ? existingRevenueMan : revenueMan}
            onChange={setRevenueMan}
            max={500}
            disabled={useExisting}
            hint="フリーランスの年間売上"
            exactValue={useExisting ? initialBusinessRevenue : undefined}
          />
          <SliderInput
            label="必要経費（PC等）"
            value={useExisting ? existingExpensesMan : expensesMan}
            onChange={setExpensesMan}
            max={200}
            disabled={useExisting}
            hint="事業にかかった経費（手元に物品が残る）"
            exactValue={useExisting ? initialBusinessExpenses - initialProportionalExpenses : undefined}
          />
          <SliderInput
            label="按分経費（家賃等）"
            value={useExisting ? existingProportionalMan : proportionalMan}
            onChange={setProportionalMan}
            max={100}
            disabled={useExisting}
            hint="家賃・通信費等の按分額（追加出費なし）"
            exactValue={useExisting ? initialProportionalExpenses : undefined}
          />
        </div>

        {/* 国民年金オプション */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={payPension}
                onChange={(e) => setPayPension(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">国民年金を支払う</span>
              <p className="text-xs text-gray-500">
                {payPension
                  ? `年間${(NATIONAL_PENSION_DISPLAY).toLocaleString()}円（月額17,510円×12）`
                  : "学生納付特例で猶予中（支払い0円）"}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 警告 */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* ステータス */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">ステータス</h3>
        <div className="space-y-3">
          <StatusRow
            label="社会保険"
            ok={r.isDependant}
            detail={r.isDependant
              ? `扶養内（収入${formatYen(r.socialInsuranceIncome)} / 上限150万円）`
              : `扶養外（収入${formatYen(r.socialInsuranceIncome)} / 上限150万円）`}
          />
          <StatusRow
            label="勤労学生控除"
            ok={r.isWorkingStudentEligible}
            detail={r.isWorkingStudentEligible
              ? `適用可（合計所得${formatYen(r.totalIncome)} / 上限85万円）`
              : `適用不可（合計所得${formatYen(r.totalIncome)} > 上限85万円）`}
          />
          <StatusRow
            label="親の控除"
            ok={r.parentDeduction.incomeTaxDeduction > 0}
            detail={r.totalIncome <= 850_000
              ? `満額（所得税${formatYen(r.parentDeduction.incomeTaxDeduction)} / 住民税${formatYen(r.parentDeduction.residentTaxDeduction)}）`
              : r.parentDeduction.incomeTaxDeduction > 0
                ? `所得税${formatYen(r.parentDeduction.incomeTaxDeduction)} / 住民税${formatYen(r.parentDeduction.residentTaxDeduction)}`
                : "なし（合計所得123万超）"}
          />
          <StatusRow
            label="所得税"
            ok={r.totalIncomeTax === 0}
            detail={r.totalIncomeTax === 0 ? "非課税" : `課税あり（${formatYenExact(r.totalIncomeTax)}）`}
          />
          <StatusRow
            label="住民税所得割"
            ok={r.residentTaxIncome === 0}
            detail={r.residentTaxIncome === 0 ? "非課税" : `課税あり（${formatYenExact(r.residentTaxIncome)}）`}
          />
        </div>
      </div>

      {/* 結果 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">結果</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-center">
            <p className="text-sm text-indigo-600 mb-1">現金手取り</p>
            <p className="text-3xl font-bold text-indigo-700">{formatYen(r.cashTakeHome)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-center">
            <p className="text-sm text-purple-600 mb-1">使えるお金</p>
            <p className="text-3xl font-bold text-purple-700">{formatYen(r.usableMoney)}</p>
          </div>
        </div>

        {/* 内訳 */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">収入合計</span>
            <span className="font-medium">{formatYen(r.salaryRevenue + r.businessRevenue)}（給与{formatYen(r.salaryRevenue)} + 売上{formatYen(r.businessRevenue)}）</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>− 経費</span>
            <span>{formatYen(r.totalExpenses)}（必要経費{formatYen(r.expenses)} + 按分{formatYen(r.proportionalExpenses)}）</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>− 国民年金</span>
            <span>{formatYen(r.nationalPension)}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>− 国保</span>
            <span>{r.isDependant ? "0円（扶養内）" : formatYen(r.nhi)}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>− 所得税</span>
            <span>{formatYenExact(r.totalIncomeTax)}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>− 住民税</span>
            <span>{formatYenExact(r.totalResidentTax)}{r.residentTaxIncome === 0 && r.residentTaxFlat > 0 ? "（均等割のみ）" : ""}</span>
          </div>
          <div className="border-t border-gray-300 pt-1 flex justify-between font-bold text-indigo-700">
            <span>＝ 現金手取り</span>
            <span>{formatYen(r.cashTakeHome)}</span>
          </div>
          <div className="flex justify-between text-purple-600">
            <span>＋ 経費分</span>
            <span>{formatYen(r.totalExpenses)}（必要経費{formatYen(r.expenses)} + 按分{formatYen(r.proportionalExpenses)}）</span>
          </div>
          <div className="border-t border-gray-300 pt-1 flex justify-between font-bold text-purple-700">
            <span>＝ 使えるお金</span>
            <span>{formatYen(r.usableMoney)}</span>
          </div>
        </div>
      </div>

      {/* グラフ */}
      <ChartsSection result={r} comparison={comparison} input={input} />

      {/* 詳細計算 */}
      <CalculationDetail result={r} />

      {/* 比較セクション */}
      <ComparisonSection comparison={comparison} input={input} />

      {/* 注意事項 */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-700 text-sm mb-2">注意事項</p>
        <p>・2026年分（令和8年分）の税制に基づく概算です。正確な税額は確定申告書等作成コーナーで計算してください</p>
        <p>・基礎控除104万円は2026年・2027年の時限措置です</p>
        <p>・国保の料率は東京23区（2026年度概算）を使用しています。自治体により異なります</p>
        <p>・社会保険の扶養判定における事業所得の「経費」の範囲は健保組合により異なる場合があります</p>
        <p>・国民年金について学生納付特例で猶予を受ける場合は、実際の支払いは0円になります</p>
        <p>・青色申告特別控除65万円（e-Tax利用）で確定申告する前提で計算しています</p>
      </div>
    </div>
  );
}

// ── スライダー入力 ─────────────────────────────────────
function SliderInput({
  label, value, onChange, max, disabled, hint, exactValue,
}: {
  label: string; value: number; onChange: (v: number) => void;
  max: number; disabled: boolean; hint: string; exactValue?: number;
}) {
  return (
    <div className={disabled ? "opacity-70" : ""}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="text-right">
          <span className="text-sm font-bold text-gray-900">{value}万円</span>
          {exactValue !== undefined && exactValue !== value * 10_000 && (
            <span className="block text-xs text-gray-400">実値 {exactValue.toLocaleString()}円</span>
          )}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
      />
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-gray-500">{hint}</p>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          disabled={disabled}
          className="w-20 text-xs text-right border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100"
        />
      </div>
    </div>
  );
}

// ── ステータス行 ──────────────────────────────────────
function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${ok ? "bg-green-50" : "bg-red-50"}`}>
      <span className="text-lg">{ok ? "✅" : "❌"}</span>
      <span className="font-medium text-gray-800 min-w-[6rem]">{label}</span>
      <span className={`text-sm ${ok ? "text-green-700" : "text-red-700"}`}>{detail}</span>
    </div>
  );
}

// ── 詳細計算テーブル ──────────────────────────────────
function CalculationDetail({ result: r }: { result: OptimizerResult }) {
  return (
    <details className="bg-white rounded-xl border border-gray-200">
      <summary className="p-6 cursor-pointer text-lg font-semibold hover:bg-gray-50">
        計算の詳細
      </summary>
      <div className="px-6 pb-6 space-y-4">
        {/* 所得計算 */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-2">所得の計算</h4>
          <table className="w-full text-sm">
            <tbody>
              <Row label="給与収入" value={r.salaryRevenue} />
              <Row label="  給与所得控除" value={-r.salaryDeduction} negative />
              <Row label="給与所得" value={r.salaryIncome} bold bg />
              <Row label="事業売上" value={r.businessRevenue} />
              <Row label="  経費合計" value={-r.totalExpenses} negative />
              <Row label="  青色申告特別控除" value={-r.blueDeduction} negative accent />
              <Row label="事業所得" value={r.businessIncome} bold bg />
              <Row label="合計所得金額" value={r.totalIncome} bold highlight />
            </tbody>
          </table>
        </div>

        {/* 所得税 */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-2">所得税</h4>
          <table className="w-full text-sm">
            <tbody>
              <Row label="合計所得金額" value={r.totalIncome} />
              <Row label="  基礎控除" value={-r.basicDeduction} negative />
              {r.workingStudentDeduction > 0 && <Row label="  勤労学生控除" value={-r.workingStudentDeduction} negative />}
              <Row label="  社会保険料控除" value={-r.socialInsuranceDeduction} negative />
              <Row label="課税所得金額" value={r.taxableIncome} bold bg />
              <Row label="所得税額" value={r.incomeTax} />
              <Row label="復興特別所得税" value={r.reconstructionTax} />
              <Row label="所得税合計" value={r.totalIncomeTax} bold highlight />
            </tbody>
          </table>
        </div>

        {/* 住民税 */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-2">住民税</h4>
          <table className="w-full text-sm">
            <tbody>
              <Row label="合計所得金額" value={r.totalIncome} />
              <Row label="  基礎控除" value={-r.residentBasicDeduction} negative />
              {r.residentStudentDeduction > 0 && <Row label="  勤労学生控除" value={-r.residentStudentDeduction} negative />}
              <Row label="  社会保険料控除" value={-r.residentSocialInsuranceDeduction} negative />
              <Row label="課税所得金額" value={r.residentTaxableIncome} bold bg />
              <Row label="所得割 (10%)" value={r.residentTaxIncome} />
              <Row label="均等割" value={r.residentTaxFlat} />
              <Row label="住民税合計" value={r.totalResidentTax} bold highlight />
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function Row({
  label, value, negative, accent, bold, bg, highlight,
}: {
  label: string; value: number;
  negative?: boolean; accent?: boolean; bold?: boolean; bg?: boolean; highlight?: boolean;
}) {
  const textClass = negative ? "text-red-600" : accent ? "text-blue-600" : bold ? "font-medium" : "text-gray-600";
  const bgClass = highlight ? "bg-indigo-50" : bg ? "bg-gray-50" : "";
  return (
    <tr className={`border-b border-gray-100 ${bgClass}`}>
      <td className={`py-2 ${bold ? "font-medium" : "text-gray-600"} ${label.startsWith("  ") ? "pl-4" : ""}`}>{label.trim()}</td>
      <td className={`py-2 text-right ${textClass}`}>
        {value < 0 ? `-${Math.abs(value).toLocaleString()}円` : `${value.toLocaleString()}円`}
      </td>
    </tr>
  );
}

// ── グラフセクション ───────────────────────────────────
const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

function ChartsSection({ result: r, comparison, input }: { result: OptimizerResult; comparison: ComparisonResult; input: OptimizerInput }) {
  // ── ドーナツチャート: 収入の内訳 ──
  const totalRevenue = r.salaryRevenue + r.businessRevenue;
  const breakdownData = [
    { name: "現金手取り", value: Math.max(0, r.cashTakeHome), color: "#6366f1" },
    { name: "経費", value: r.totalExpenses, color: "#f59e0b" },
    { name: "国民年金", value: r.nationalPension, color: "#10b981" },
    ...(r.nhi > 0 ? [{ name: "国保", value: r.nhi, color: "#ef4444" }] : []),
    ...(r.totalIncomeTax > 0 ? [{ name: "所得税", value: r.totalIncomeTax, color: "#8b5cf6" }] : []),
    ...(r.totalResidentTax > 0 ? [{ name: "住民税", value: r.totalResidentTax, color: "#ec4899" }] : []),
  ].filter(d => d.value > 0);

  // ── 棒グラフ: 現在 vs +20万 ──
  const barData = [
    {
      label: "現在",
      現金手取り: Math.round(comparison.current.cashTakeHome / 10_000),
      使えるお金: Math.round(comparison.current.usableMoney / 10_000),
    },
    {
      label: "売上+20万",
      現金手取り: Math.round(comparison.increased.cashTakeHome / 10_000),
      使えるお金: Math.round(comparison.increased.usableMoney / 10_000),
    },
  ];

  // ── エリアチャート: 売上変化と手取りカーブ ──
  interface CurvePoint {
    revenue: number;
    totalRevenue: number; // 収入合計(給与+売上)
    cashTakeHome: number;
    usableMoney: number;
    isDependant: boolean;
    totalIncome: number;
    isWorkingStudentEligible: boolean;
    isCurrent?: boolean;
  }
  const currentRevenueMan = Math.round(input.businessRevenue / 10_000);

  const curveData = useMemo(() => {
    const points: CurvePoint[] = [];
    const baseExpenses = input.expenses;
    const baseProp = input.proportionalExpenses;
    const baseSalary = input.salaryRevenue;
    const revSteps = new Set<number>();
    // 売上0〜300万を5万刻み
    for (let rev = 0; rev <= 3_000_000; rev += 50_000) revSteps.add(rev);
    // 現在地を正確に含める
    revSteps.add(input.businessRevenue);
    const sortedRevs = Array.from(revSteps).sort((a, b) => a - b);
    for (const rev of sortedRevs) {
      const trial = calculateOptimizer({
        salaryRevenue: baseSalary,
        businessRevenue: rev,
        expenses: baseExpenses,
        proportionalExpenses: baseProp,
        payNationalPension: input.payNationalPension,
      });
      points.push({
        revenue: rev / 10_000,
        totalRevenue: Math.round((trial.salaryRevenue + trial.businessRevenue) / 10_000),
        cashTakeHome: Math.round(trial.cashTakeHome / 10_000),
        usableMoney: Math.round(trial.usableMoney / 10_000),
        isDependant: trial.isDependant,
        totalIncome: trial.totalIncome,
        isWorkingStudentEligible: trial.isWorkingStudentEligible,
        isCurrent: rev === input.businessRevenue,
      });
    }
    return points;
  }, [input.salaryRevenue, input.businessRevenue, input.expenses, input.proportionalExpenses, input.payNationalPension]);

  // 各ラインの売上(万円)を計算
  // 社保扶養ライン: isDependant が false になる最初のポイント
  const dependantBorderRevMan = useMemo(() => {
    for (const p of curveData) {
      if (!p.isDependant) return p.revenue;
    }
    return null;
  }, [curveData]);

  // 勤労学生控除ライン: 合計所得 > 85万になる最初のポイント
  const studentDeductionBorderRevMan = useMemo(() => {
    for (const p of curveData) {
      if (!p.isWorkingStudentEligible) return p.revenue;
    }
    return null;
  }, [curveData]);

  // 親の特定親族特別控除満額ライン: 合計所得 > 85万
  // (勤労学生控除と同じ閾値なのでstudentDeductionBorderRevManを共用)

  // 親の特定親族特別控除ゼロライン: 合計所得 > 123万
  const parentDeductionZeroBorderRevMan = useMemo(() => {
    for (const p of curveData) {
      if (p.totalIncome > 1_230_000) return p.revenue;
    }
    return null;
  }, [curveData]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltipPie = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-sm">
        <p className="font-medium" style={{ color: d.payload.color }}>{d.name}</p>
        <p>{formatYen(d.value)}（{totalRevenue > 0 ? ((d.value / totalRevenue) * 100).toFixed(1) : 0}%）</p>
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltipCurve = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0]?.payload as CurvePoint | undefined;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-sm">
        <p className="font-medium text-gray-700">
          売上 {label}万円
          {pt?.isCurrent && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">現在</span>}
        </p>
        {payload.map((p: { name: string; value: number; color: string }, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}万円</p>
        ))}
        {pt && (
          <div className="mt-1 pt-1 border-t border-gray-100 space-y-0.5">
            <p className={pt.isDependant ? "text-green-600" : "text-red-600"}>
              {pt.isDependant ? "✅ 社保扶養内" : "❌ 社保扶養外"}
            </p>
            <p className={pt.isWorkingStudentEligible ? "text-green-600" : "text-red-600"}>
              {pt.isWorkingStudentEligible ? "✅ 勤労学生控除" : "❌ 勤労学生控除なし"}
            </p>
            <p className={pt.totalIncome <= 1_230_000 ? "text-green-600" : "text-red-600"}>
              {pt.totalIncome <= 850_000 ? "✅ 親の控除(満額)" : pt.totalIncome <= 1_230_000 ? "⚠️ 親の控除(減額)" : "❌ 親の控除なし"}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-6">グラフで見る</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ドーナツチャート */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-3 text-center">収入の内訳</h4>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={breakdownData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {breakdownData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltipPie />} />
            </PieChart>
          </ResponsiveContainer>
          {/* 凡例 */}
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {breakdownData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        {/* 棒グラフ: 比較 */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-3 text-center">現在 vs 売上+20万</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="万" />
              <Tooltip formatter={(value) => `${value}万円`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="現金手取り" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="使えるお金" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 折れ線(エリア)チャート: 手取りカーブ */}
      <div className="mt-8">
        <h4 className="text-sm font-bold text-gray-700 mb-3 text-center">
          売上と手取りの関係（働き損ゾーン可視化）
        </h4>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={curveData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
            <defs>
              <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorUsable" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorTotalRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="revenue"
              type="number"
              domain={[0, 300]}
              tick={{ fontSize: 11 }}
              label={{ value: "事業売上（万円）", position: "insideBottom", offset: -22, fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} unit="万" />
            <Tooltip content={<CustomTooltipCurve />} />
            {/* 勤労学生控除 / 親の控除満額ライン (合計所得85万) */}
            {studentDeductionBorderRevMan !== null && (
              <ReferenceLine
                x={studentDeductionBorderRevMan}
                stroke="#f59e0b"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: "勤労学生/親控除満額", position: "top", fill: "#f59e0b", fontSize: 10 }}
              />
            )}
            {/* 親の特定親族特別控除ゼロライン (合計所得123万) */}
            {parentDeductionZeroBorderRevMan !== null && (
              <ReferenceLine
                x={parentDeductionZeroBorderRevMan}
                stroke="#f97316"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: "親の控除ゼロ", position: "top", fill: "#f97316", fontSize: 10 }}
              />
            )}
            {/* 社保扶養ライン (年収150万) */}
            {dependantBorderRevMan !== null && (
              <ReferenceLine
                x={dependantBorderRevMan}
                stroke="#ef4444"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{ value: "社保扶養上限", position: "top", fill: "#ef4444", fontSize: 10 }}
              />
            )}
            {/* 現在位置: 縦線 */}
            <ReferenceLine
              x={currentRevenueMan}
              stroke="#6366f1"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: "現在", position: "top", fill: "#6366f1", fontSize: 11 }}
            />
            {/* 現在位置: 各カーブ上のドット */}
            <ReferenceDot
              x={currentRevenueMan}
              y={Math.round(r.cashTakeHome / 10_000)}
              r={5}
              fill="#6366f1"
              stroke="#fff"
              strokeWidth={2}
            />
            <ReferenceDot
              x={currentRevenueMan}
              y={Math.round(r.usableMoney / 10_000)}
              r={5}
              fill="#a78bfa"
              stroke="#fff"
              strokeWidth={2}
            />
            {input.salaryRevenue > 0 && (
              <Area
                type="monotone"
                dataKey="totalRevenue"
                name="収入合計（給与+売上）"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                fill="url(#colorTotalRev)"
              />
            )}
            <Area
              type="monotone"
              dataKey="usableMoney"
              name="使えるお金"
              stroke="#a78bfa"
              strokeWidth={2}
              fill="url(#colorUsable)"
            />
            <Area
              type="monotone"
              dataKey="cashTakeHome"
              name="現金手取り"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#colorCash)"
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* 凡例 */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-3 text-xs text-gray-600">
          {input.salaryRevenue > 0 && (
            <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-[#94a3b8]" />収入合計</span>
          )}
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-[#a78bfa]" />使えるお金</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-[#6366f1]" />現金手取り</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-[#6366f1]" />現在の売上</span>
          {studentDeductionBorderRevMan !== null && (
            <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-[#f59e0b]" />勤労学生/親控除満額（所得85万）</span>
          )}
          {parentDeductionZeroBorderRevMan !== null && (
            <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-[#f97316]" />親の控除ゼロ（所得123万）</span>
          )}
          {dependantBorderRevMan !== null && (
            <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-[#ef4444]" />社保扶養上限（年収150万）</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 比較セクション ─────────────────────────────────────
function ComparisonSection({ comparison, input }: { comparison: ComparisonResult; input: OptimizerInput }) {
  const { current, increased, cashDiff, usableDiff, breakEvenRevenue } = comparison;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">扶養を超えた場合の比較</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* 現在 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-700 mb-2">現在の設定{current.isDependant ? "（扶養内）" : "（扶養外）"}</p>
          <p className="text-sm">現金手取り: <span className="font-bold">{formatYen(current.cashTakeHome)}</span></p>
          <p className="text-sm">使えるお金: <span className="font-bold">{formatYen(current.usableMoney)}</span></p>
        </div>
        {/* +20万 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm font-medium text-orange-700 mb-2">売上+20万の場合{increased.isDependant ? "（扶養内）" : "（扶養外）"}</p>
          <p className="text-sm">現金手取り: <span className="font-bold">{formatYen(increased.cashTakeHome)}</span></p>
          <p className="text-sm">使えるお金: <span className="font-bold">{formatYen(increased.usableMoney)}</span></p>
          {!increased.isDependant && increased.nhi > 0 && (
            <p className="text-xs text-orange-600 mt-1">国保 {formatYenExact(increased.nhi)} 発生</p>
          )}
        </div>
      </div>

      {/* 差額 */}
      <div className={`rounded-lg p-4 text-center ${cashDiff >= 0 ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"}`}>
        <p className="text-sm text-gray-600 mb-1">売上+20万による手取り差</p>
        <p className={`text-2xl font-bold ${cashDiff >= 0 ? "text-blue-700" : "text-red-700"}`}>
          {cashDiff >= 0 ? "+" : ""}{formatYen(cashDiff)}
        </p>
        {cashDiff < 0 && (
          <p className="text-xs text-red-600 mt-1">
            売上を20万円増やしても手取りが減る「働き損」ゾーンです
          </p>
        )}
      </div>

      {/* 損益分岐点 */}
      {breakEvenRevenue !== null && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">損益分岐点（扶養内の手取りを超える売上）</p>
          <p className="text-xl font-bold text-yellow-700">{formatYen(breakEvenRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">
            売上をここまで増やせば、扶養から外れても現在より手取りが増えます
          </p>
        </div>
      )}
    </div>
  );
}
