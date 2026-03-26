"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return {
    fiscalYear: parseInt(map.fiscalYear || String(new Date().getFullYear())),
    userName: map.userName || "",
    businessName: map.businessName || "",
    salaryRevenue: parseInt(map.salaryRevenue || "0"),
    isStudent: map.isStudent === "true",
    blueReturnLevel: (parseInt(map.blueReturnLevel || "65") as 65 | 55),
    address: map.address || "",
    postalCode: map.postalCode || "",
    phone: map.phone || "",
    email: map.email || "",
    bankName: map.bankName || "",
    bankBranch: map.bankBranch || "",
    bankAccountType: map.bankAccountType || "普通",
    bankAccountNumber: map.bankAccountNumber || "",
    bankAccountHolder: map.bankAccountHolder || "",
    invoiceRegistrationNumber: map.invoiceRegistrationNumber || "",
  };
}

export async function updateSettings(data: Record<string, string>) {
  for (const [key, value] of Object.entries(data)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/simulator");
}

export async function getSetting(key: string) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value || null;
}

export async function getSubscriptionTemplates(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: "subscriptionTemplates" } });
  return setting?.value || null;
}

export async function saveSubscriptionTemplates(json: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "subscriptionTemplates" },
    update: { value: json },
    create: { key: "subscriptionTemplates", value: json },
  });
  revalidatePath("/journal");
  revalidatePath("/");
}
