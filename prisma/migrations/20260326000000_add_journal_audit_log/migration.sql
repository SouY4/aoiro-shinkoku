-- CreateTable: 仕訳変更履歴（優良電子帳簿要件対応）
CREATE TABLE "JournalAuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "journalEntryId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" TEXT,
    "afterData" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "JournalAuditLog_journalEntryId_idx" ON "JournalAuditLog"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalAuditLog_changedAt_idx" ON "JournalAuditLog"("changedAt");
