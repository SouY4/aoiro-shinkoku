"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getClients(includeInactive = false) {
  return prisma.client.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { documents: true } } },
  });
}

export async function getClient(id: number) {
  return prisma.client.findUnique({
    where: { id },
    include: { documents: { orderBy: { issueDate: "desc" }, take: 10 } },
  });
}

export async function createClient(data: {
  name: string;
  honorific?: string;
  contactPerson?: string;
  postalCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  memo?: string;
}) {
  if (!data.name?.trim()) throw new Error("取引先名を入力してください");
  const client = await prisma.client.create({
    data: {
      name: data.name.trim(),
      honorific: data.honorific || "御中",
      contactPerson: data.contactPerson || null,
      postalCode: data.postalCode || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      memo: data.memo || null,
    },
  });
  revalidatePath("/clients");
  revalidatePath("/documents");
  return client;
}

export async function updateClient(
  id: number,
  data: {
    name?: string;
    honorific?: string;
    contactPerson?: string;
    postalCode?: string;
    address?: string;
    phone?: string;
    email?: string;
    memo?: string;
    isActive?: boolean;
  }
) {
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name.trim() }),
      ...(data.honorific != null && { honorific: data.honorific }),
      ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson || null }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.memo !== undefined && { memo: data.memo || null }),
      ...(data.isActive != null && { isActive: data.isActive }),
    },
  });
  revalidatePath("/clients");
  revalidatePath("/documents");
  return client;
}

export async function deleteClient(id: number) {
  const docCount = await prisma.businessDocument.count({ where: { clientId: id } });
  if (docCount > 0) {
    throw new Error("この取引先に紐付く書類があるため削除できません。無効化してください。");
  }
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
}
