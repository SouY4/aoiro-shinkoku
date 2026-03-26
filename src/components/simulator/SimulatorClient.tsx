"use client";

import { useState } from "react";
import { calculateThresholds, calculateRemainingBusinessCapacity } from "@/lib/threshold-calculator";
import { calculateIncomeTax } from "@/lib/tax-calculator";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  initialSalaryRevenue: number;
  initialBusinessRevenue: number;
  initialBusinessExpenses: number;
  blueReturnLevel: 65 | 55;
  isStudent: boolean;
}

export default function SimulatorClient({
  initialSalaryRevenue,
  initialBusinessRevenue,
  initialBusinessExpenses,
  blueReturnLevel,
  isStudent,
}: Props) {
  const [salaryRevenue, setSalaryRevenue] = useState(initialSalaryRevenue);
  const [businessRevenue, setBusinessRevenue] = useState(initialBusinessRevenue);
  const [businessExpenses, setBusinessExpenses] = useState(initialBusinessExpenses);

  const thresholds = calculateThresholds({
    salaryRevenue,
    businessRevenue,
    businessExpenses,
    blueReturnLevel,
    age: 19,
  });

  const remaining = calculateRemainingBusinessCapacity({
    salaryRevenue,
    currentBusinessExpenses: businessExpenses,
    blueReturnLevel,
  });

  const tax = calculateIncomeTax({
    salaryRevenue,
    businessRevenue,
    businessExpenses,
    isStudent,
    blueReturnLevel,
  });

  return (
    <div className="space-y-6">
      {/* 入力エリア */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">収入を入力</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">給与収入（年間）</label>
            <input
              type="number" min={0} step={10000}
              value={salaryRevenue}
              onChange={(e) => setSalaryRevenue(parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">アルバイト等の給与収入</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">事業収入（年間）</label>
            <input
              type="number" min={0} step={10000}
              value={businessRevenue}
              onChange={(e) => setBusinessRevenue(parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">フリーランス等の売上</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">必要経費（年間）</label>
            <input
              type="number" min={0} step={10000}
              value={businessExpenses}
              onChange={(e) => setBusinessExpenses(parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">事業にかかった経費</p>
          </div>
        </div>
      </div>

      {/* あといくら稼げるか */}
      <div className="bg-white rounded-xl border border-blue-200 p-6">
        <h2 className="text-lg font-semibold mb-4 text-blue-700">あといくら事業で稼げるか？</h2>
        <p className="text-xs text-gray-500 mb-4">※現在の給与収入・経費を前提とした事業収入の上限目安（青色申告特別控除{blueReturnLevel}万円適用）</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">親の扶養を維持</p>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(remaining.forDependentDeduction)}</p>
            <p className="text-xs text-gray-500 mt-1">事業収入の上限</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">勤労学生控除を維持</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(remaining.forWorkingStudent)}</p>
            <p className="text-xs text-gray-500 mt-1">事業収入の上限</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">社保の扶養を維持</p>
            <p className="text-2xl font-bold text-purple-700">{formatCurrency(remaining.forHealthInsurance)}</p>
            <p className="text-xs text-gray-500 mt-1">事業収入の上限</p>
          </div>
        </div>
      </div>

      {/* しきい値バー */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">各しきい値の状況</h2>
        <div className="space-y-4">
          {thresholds.map((t) => {
            const barColor = t.isExceeded ? "bg-red-500" : t.percentage > 80 ? "bg-amber-500" : t.percentage > 60 ? "bg-yellow-500" : "bg-green-500";
            const bgColor = t.isExceeded ? "bg-red-50" : t.percentage > 80 ? "bg-amber-50" : "bg-green-50";
            return (
              <div key={t.name} className={`rounded-lg p-4 ${bgColor}`}>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-medium">{t.nameJa}</span>
                    <span className="text-xs text-gray-500 ml-2">({t.basis})</span>
                  </div>
                  {t.isExceeded ? (
                    <span className="text-red-600 font-bold text-sm">超過!</span>
                  ) : (
                    <span className="text-sm">残り <span className="font-bold text-blue-700">{formatCurrency(t.remaining)}</span></span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-1">
                  <div className={`h-3 rounded-full ${barColor}`} style={{ width: `${Math.min(100, t.percentage)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatCurrency(t.currentAmount)}</span>
                  <span>{formatCurrency(t.threshold)}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{t.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 税額計算結果 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">所得税の計算</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">給与収入</td><td className="py-2 text-right">{formatCurrency(tax.salaryRevenue)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600 pl-4">給与所得控除</td><td className="py-2 text-right text-red-600">-{formatCurrency(tax.salaryIncomeDeduction)}</td></tr>
            <tr className="border-b border-gray-200 bg-gray-50"><td className="py-2 font-medium">給与所得</td><td className="py-2 text-right font-medium">{formatCurrency(tax.salaryIncome)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">事業収入</td><td className="py-2 text-right">{formatCurrency(tax.businessRevenue)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600 pl-4">必要経費</td><td className="py-2 text-right text-red-600">-{formatCurrency(tax.businessExpenses)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600 pl-4">青色申告特別控除</td><td className="py-2 text-right text-blue-600">-{formatCurrency(tax.blueReturnDeduction)}</td></tr>
            <tr className="border-b border-gray-200 bg-gray-50"><td className="py-2 font-medium">事業所得</td><td className="py-2 text-right font-medium">{formatCurrency(tax.businessIncome)}</td></tr>
            <tr className="border-b border-gray-300 bg-blue-50"><td className="py-3 font-bold">合計所得金額</td><td className="py-3 text-right font-bold">{formatCurrency(tax.totalIncome)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600 pl-4">基礎控除</td><td className="py-2 text-right text-red-600">-{formatCurrency(tax.basicDeduction)}</td></tr>
            {tax.workingStudentDeduction > 0 && (
              <tr className="border-b border-gray-100"><td className="py-2 text-gray-600 pl-4">勤労学生控除</td><td className="py-2 text-right text-red-600">-{formatCurrency(tax.workingStudentDeduction)}</td></tr>
            )}
            <tr className="border-b border-gray-200 bg-gray-50"><td className="py-2 font-medium">課税所得金額</td><td className="py-2 text-right font-medium">{formatCurrency(tax.taxableIncome)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">所得税額</td><td className="py-2 text-right">{formatCurrency(tax.incomeTax)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">復興特別所得税</td><td className="py-2 text-right">{formatCurrency(tax.reconstructionTax)}</td></tr>
            <tr className="bg-blue-50"><td className="py-3 font-bold text-blue-800">納付税額</td><td className="py-3 text-right font-bold text-blue-800">{formatCurrency(tax.totalTax)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
