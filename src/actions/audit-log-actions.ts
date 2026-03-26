"use server";

import { prisma } from "@/lib/prisma";

export async function getAuditLogs(params?: {
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  journalEntryId?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params?.action) where.action = params.action;
  if (params?.journalEntryId) where.journalEntryId = params.journalEntryId;
  if (params?.dateFrom || params?.dateTo) {
    where.changedAt = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lt: new Date(new Date(params.dateTo).getTime() + 86400000) } : {}),
    };
  }
  const logs = await prisma.journalAuditLog.findMany({
    where,
    orderBy: { changedAt: "desc" },
    take: 500,
  });
  return logs.map((log) => ({
    id: log.id,
    journalEntryId: log.journalEntryId,
    action: log.action as "create" | "update" | "delete",
    beforeData: log.beforeData ? (JSON.parse(log.beforeData) as Record<string, unknown>) : null,
    afterData: log.afterData ? (JSON.parse(log.afterData) as Record<string, unknown>) : null,
    changedAt: log.changedAt.toISOString(),
  }));
}
