import { getSettings } from "@/actions/settings-actions";
import { getBusinessSummary } from "@/actions/report-actions";
import SimulatorClient from "@/components/simulator/SimulatorClient";
import OptimizerSection from "@/components/simulator/OptimizerSection";

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const settings = await getSettings();
  const summary = await getBusinessSummary(settings.fiscalYear);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">収入シミュレーター</h1>
      <p className="text-gray-500 text-sm mb-6">各種控除の適用条件と残りの稼げる金額を確認できます</p>
      <SimulatorClient
        initialSalaryRevenue={settings.salaryRevenue}
        initialBusinessRevenue={summary.totalRevenue}
        initialBusinessExpenses={summary.totalExpenses}
        blueReturnLevel={settings.blueReturnLevel}
        isStudent={settings.isStudent}
      />
      <div className="mt-10">
        <OptimizerSection
          initialSalaryRevenue={settings.salaryRevenue}
          initialBusinessRevenue={summary.totalRevenue}
          initialBusinessExpenses={summary.totalExpenses}
        />
      </div>
    </div>
  );
}
