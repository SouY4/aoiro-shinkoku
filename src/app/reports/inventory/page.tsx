import { getSettings } from "@/actions/settings-actions";
import { getInventoryItems, getInventoryTotal } from "@/actions/inventory-actions";
import { toReiwa } from "@/lib/formatters";
import InventoryTable from "@/components/inventory/InventoryTable";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const settings = await getSettings();
  const fiscalYear = settings.fiscalYear;
  const items = await getInventoryItems(fiscalYear);
  const total = await getInventoryTotal(fiscalYear);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">棚卸表</h1>
      <p className="text-gray-500 text-sm mb-6">
        {toReiwa(fiscalYear)}度 期末棚卸 — 品目・数量・単価・金額を記録し、合計で「期末商品棚卸高」の仕訳を作成できます。
      </p>

      <InventoryTable
        fiscalYear={fiscalYear}
        initialItems={items.map((i) => ({
          id: i.id,
          fiscalYear: i.fiscalYear,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount,
          sortOrder: i.sortOrder,
        }))}
        totalAmount={total}
      />

      <p className="mt-4 text-sm text-gray-500">
        「期末棚卸高の仕訳を作成」を押すと、(借) 期末商品棚卸高 (貸) 仕入高 の決算整理仕訳が12/31で登録されます。既に同様の仕訳をしている場合は重複しないよう注意してください。
      </p>
    </div>
  );
}
