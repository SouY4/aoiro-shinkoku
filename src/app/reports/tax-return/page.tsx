import { getSettings } from "@/actions/settings-actions";
import { getTaxReturnData } from "@/actions/tax-return-actions";
import TaxReturnSheet from "@/components/tax-return/TaxReturnSheet";

export const dynamic = "force-dynamic";

export default async function TaxReturnPage() {
  const { fiscalYear } = await getSettings();
  const data = await getTaxReturnData(fiscalYear);
  const isYearOver = new Date() >= new Date(fiscalYear + 1, 0, 1);

  return <TaxReturnSheet data={data} isYearOver={isYearOver} />;
}
