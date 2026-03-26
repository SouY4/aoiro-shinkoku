"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const TYPE_PREFIXES: Record<string, string> = {
  invoice: "INV",
  quotation: "QUO",
  delivery: "DEL",
};

async function generateDocumentNumber(type: string, year: number): Promise<string> {
  const prefix = TYPE_PREFIXES[type] || "DOC";
  const pattern = `${prefix}-${year}-`;

  const lastDoc = await prisma.businessDocument.findFirst({
    where: { documentNumber: { startsWith: pattern } },
    orderBy: { documentNumber: "desc" },
    select: { documentNumber: true },
  });

  let nextSeq = 1;
  if (lastDoc) {
    const parts = lastDoc.documentNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${pattern}${String(nextSeq).padStart(3, "0")}`;
}

function calculateTotals(lines: { quantity: number; unitPrice: number; taxRate: number }[]) {
  let subtotal = 0;

  // 行ごとの金額を集計
  for (const line of lines) {
    subtotal += Math.round(line.quantity * line.unitPrice);
  }

  // インボイス制度準拠: 消費税の端数処理は税率ごとに1回
  const byRate = new Map<number, number>();
  for (const line of lines) {
    const amount = Math.round(line.quantity * line.unitPrice);
    byRate.set(line.taxRate, (byRate.get(line.taxRate) || 0) + amount);
  }
  let taxAmount = 0;
  for (const [rate, rateSubtotal] of byRate) {
    taxAmount += Math.floor(rateSubtotal * rate / 100);
  }

  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

export async function getDocuments(filters?: {
  type?: string;
  clientId?: number;
  status?: string;
  fiscalYear?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.type) where.type = filters.type;
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.status) where.status = filters.status;
  if (filters?.fiscalYear) {
    where.issueDate = {
      gte: new Date(filters.fiscalYear, 0, 1),
      lt: new Date(filters.fiscalYear + 1, 0, 1),
    };
  }

  return prisma.businessDocument.findMany({
    where,
    include: {
      client: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { issueDate: "desc" },
  });
}

export async function getDocument(id: number) {
  return prisma.businessDocument.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { orderBy: { sortOrder: "asc" } },
      sourceDocument: true,
      derivedDocuments: { include: { client: true } },
    },
  });
}

export async function createDocument(data: {
  type: string;
  clientId: number;
  issueDate: string;
  dueDate?: string;
  subject?: string;
  notes?: string;
  taxRate?: number;
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }[];
  sourceDocumentId?: number;
}) {
  if (!data.type || !["invoice", "quotation", "delivery"].includes(data.type)) {
    throw new Error("書類種別を選択してください");
  }
  if (!data.clientId) throw new Error("取引先を選択してください");
  if (!data.issueDate) throw new Error("発行日を入力してください");
  if (!data.lines || data.lines.length === 0) {
    throw new Error("明細行を最低1行入力してください");
  }
  for (let i = 0; i < data.lines.length; i++) {
    if (!data.lines[i].description?.trim()) {
      throw new Error(`明細行${i + 1}: 品名を入力してください`);
    }
  }

  const year = new Date(data.issueDate).getFullYear();
  const documentNumber = await generateDocumentNumber(data.type, year);
  const defaultTaxRate = data.taxRate ?? 10;

  const linesWithAmounts = data.lines.map((line, idx) => ({
    ...line,
    taxRate: line.taxRate ?? defaultTaxRate,
    amount: Math.round(line.quantity * line.unitPrice),
    sortOrder: idx + 1,
  }));

  const { subtotal, taxAmount, total } = calculateTotals(linesWithAmounts);

  const document = await prisma.businessDocument.create({
    data: {
      type: data.type,
      documentNumber,
      clientId: data.clientId,
      issueDate: new Date(data.issueDate),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      subject: data.subject || null,
      notes: data.notes || null,
      status: "draft",
      subtotal,
      taxRate: defaultTaxRate,
      taxAmount,
      total,
      sourceDocumentId: data.sourceDocumentId || null,
      lines: {
        create: linesWithAmounts.map((line) => ({
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amount,
          taxRate: line.taxRate,
          sortOrder: line.sortOrder,
        })),
      },
    },
    include: { client: true, lines: { orderBy: { sortOrder: "asc" } } },
  });

  revalidatePath("/documents");
  return document;
}

export async function updateDocument(
  id: number,
  data: {
    clientId?: number;
    issueDate?: string;
    dueDate?: string | null;
    subject?: string;
    notes?: string;
    status?: string;
    taxRate?: number;
    lines?: {
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
    }[];
  }
) {
  const existing = await prisma.businessDocument.findUnique({ where: { id } });
  if (!existing) throw new Error("書類が見つかりません");

  if (data.lines) {
    const defaultTaxRate = data.taxRate ?? existing.taxRate;
    const linesWithAmounts = data.lines.map((line, idx) => ({
      ...line,
      taxRate: line.taxRate ?? defaultTaxRate,
      amount: Math.round(line.quantity * line.unitPrice),
      sortOrder: idx + 1,
    }));
    const { subtotal, taxAmount, total } = calculateTotals(linesWithAmounts);

    // Delete old lines and create new ones
    await prisma.documentLine.deleteMany({ where: { documentId: id } });
    const document = await prisma.businessDocument.update({
      where: { id },
      data: {
        ...(data.clientId != null && { clientId: data.clientId }),
        ...(data.issueDate != null && { issueDate: new Date(data.issueDate) }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.subject !== undefined && { subject: data.subject || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.status != null && { status: data.status }),
        taxRate: defaultTaxRate,
        subtotal,
        taxAmount,
        total,
        lines: {
          create: linesWithAmounts.map((line) => ({
            description: line.description.trim(),
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            amount: line.amount,
            taxRate: line.taxRate,
            sortOrder: line.sortOrder,
          })),
        },
      },
      include: { client: true, lines: { orderBy: { sortOrder: "asc" } } },
    });
    revalidatePath("/documents");
    revalidatePath(`/documents/${id}`);
    return document;
  }

  // Metadata only update
  const document = await prisma.businessDocument.update({
    where: { id },
    data: {
      ...(data.clientId != null && { clientId: data.clientId }),
      ...(data.issueDate != null && { issueDate: new Date(data.issueDate) }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.subject !== undefined && { subject: data.subject || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.status != null && { status: data.status }),
    },
    include: { client: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return document;
}

export async function deleteDocument(id: number) {
  await prisma.businessDocument.delete({ where: { id } });
  revalidatePath("/documents");
}

export async function convertDocument(sourceId: number, targetType: string) {
  const source = await prisma.businessDocument.findUnique({
    where: { id: sourceId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) throw new Error("元の書類が見つかりません");
  if (!["invoice", "quotation", "delivery"].includes(targetType)) {
    throw new Error("変換先の書類種別が不正です");
  }

  const today = new Date().toISOString().split("T")[0];

  return createDocument({
    type: targetType,
    clientId: source.clientId,
    issueDate: today,
    subject: source.subject || undefined,
    notes: source.notes || undefined,
    taxRate: source.taxRate,
    lines: source.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
    })),
    sourceDocumentId: sourceId,
  });
}

export async function duplicateDocument(sourceId: number) {
  const source = await prisma.businessDocument.findUnique({
    where: { id: sourceId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) throw new Error("元の書類が見つかりません");

  const today = new Date().toISOString().split("T")[0];

  return createDocument({
    type: source.type,
    clientId: source.clientId,
    issueDate: today,
    subject: source.subject || undefined,
    notes: source.notes || undefined,
    taxRate: source.taxRate,
    lines: source.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
    })),
  });
}
