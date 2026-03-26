import { DEFAULT_ACCOUNTS } from "../src/lib/accounts-seed";

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const prisma = new PrismaClient();

  try {
    console.log("シードデータを投入中...");

    // デフォルト勘定科目を挿入
    for (const account of DEFAULT_ACCOUNTS) {
      await prisma.account.upsert({
        where: { code: account.code },
        update: {},
        create: {
          code: account.code,
          name: account.name,
          type: account.type,
          category: account.category,
          isDefault: true,
          isActive: true,
          sortOrder: account.sortOrder,
        },
      });
    }
    console.log(`  勘定科目: ${DEFAULT_ACCOUNTS.length}件`);

    // デフォルト設定
    const defaultSettings = [
      { key: "fiscalYear", value: String(new Date().getFullYear()) },
      { key: "userName", value: "" },
      { key: "businessName", value: "" },
      { key: "salaryRevenue", value: "0" },
      { key: "isStudent", value: "true" },
      { key: "blueReturnLevel", value: "65" },
    ];

    for (const setting of defaultSettings) {
      await prisma.setting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }
    console.log(`  設定: ${defaultSettings.length}件`);

    // 当年度の会計年度レコード
    const year = new Date().getFullYear();
    await prisma.fiscalYear.upsert({
      where: { year },
      update: {},
      create: {
        year,
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31, 23, 59, 59),
        isClosed: false,
      },
    });
    console.log(`  会計年度: ${year}年`);

    console.log("シードデータの投入が完了しました。");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
