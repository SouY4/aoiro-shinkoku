"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";

const RECEIPTS_DIR = process.env.RECEIPTS_DIR ?? path.join(process.cwd(), "data", "receipts");

export async function uploadReceipt(formData: FormData) {
  const file = formData.get("file") as File;
  const journalEntryId = formData.get("journalEntryId") as string | null;

  if (!file) throw new Error("ファイルが選択されていません");

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("JPEG、PNG、WebP、PDF形式のファイルのみアップロードできます");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("ファイルサイズは10MB以下にしてください");
  }

  await mkdir(RECEIPTS_DIR, { recursive: true });

  const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = path.join(RECEIPTS_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const receipt = await prisma.receipt.create({
    data: {
      filePath: filename,
      originalName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      journalEntryId: journalEntryId ? parseInt(journalEntryId) : null,
    },
  });

  revalidatePath("/journal");
  return receipt;
}

export async function deleteReceipt(id: number) {
  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (receipt) {
    try {
      await unlink(path.join(RECEIPTS_DIR, receipt.filePath));
    } catch {
      // ファイルが存在しない場合は無視
    }
    await prisma.receipt.delete({ where: { id } });
  }
  revalidatePath("/journal");
}

export async function getReceiptsForEntry(journalEntryId: number) {
  return prisma.receipt.findMany({
    where: { journalEntryId },
    orderBy: { uploadedAt: "desc" },
  });
}

/** 領収書を仕訳に紐づける／紐付け解除 */
export async function linkReceiptToEntry(receiptId: number, journalEntryId: number | null) {
  await prisma.receipt.update({
    where: { id: receiptId },
    data: { journalEntryId },
  });
  revalidatePath("/journal");
}
