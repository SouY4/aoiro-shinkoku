import { getAccounts } from "@/actions/account-actions";
import { getStripeImportConfig } from "@/actions/stripe-import-actions";
import StripeImportClient from "@/components/journal/StripeImportClient";

export const dynamic = "force-dynamic";

export default async function StripeImportPage() {
  const [accounts, config] = await Promise.all([getAccounts(), getStripeImportConfig()]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Stripe取込</h1>
      <p className="text-gray-500 text-sm mb-6">
        Stripe の balance_history.csv から、月ごとの決済手数料（charge の手数料 ＋ stripe_fee）を集計して仕訳を登録します。
      </p>
      <StripeImportClient accounts={accounts} initialConfig={config} />
    </div>
  );
}
