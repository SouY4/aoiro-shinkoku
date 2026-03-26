import { getAccounts } from "@/actions/account-actions";
import { getSettings } from "@/actions/settings-actions";
import { toReiwa } from "@/lib/formatters";
import LedgerClient from "@/components/ledger/LedgerClient";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const settings = await getSettings();
  const accounts = await getAccounts();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">総勘定元帳</h1>
      <p className="text-gray-500 text-sm mb-6">{toReiwa(settings.fiscalYear)}度</p>
      <LedgerClient accounts={accounts} fiscalYear={settings.fiscalYear} />
    </div>
  );
}
