-- CreateTable
CREATE TABLE "SubAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JournalLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "journalEntryId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "subAccountId" INTEGER,
    "debitAmount" INTEGER NOT NULL DEFAULT 0,
    "creditAmount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "allocationPercent" INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JournalLine_subAccountId_fkey" FOREIGN KEY ("subAccountId") REFERENCES "SubAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JournalLine" ("accountId", "allocationPercent", "creditAmount", "debitAmount", "description", "id", "journalEntryId") SELECT "accountId", "allocationPercent", "creditAmount", "debitAmount", "description", "id", "journalEntryId" FROM "JournalLine";
DROP TABLE "JournalLine";
ALTER TABLE "new_JournalLine" RENAME TO "JournalLine";
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");
CREATE INDEX "JournalLine_subAccountId_idx" ON "JournalLine"("subAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SubAccount_accountId_idx" ON "SubAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_accountId_name_key" ON "SubAccount"("accountId", "name");

-- Seed default sub-accounts for 「その他の預金」(code 1004): 銀行口座 / Stripe残高
INSERT INTO "SubAccount" ("accountId", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT "id", '銀行口座', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Account" WHERE "code" = '1004';
INSERT INTO "SubAccount" ("accountId", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT "id", 'Stripe残高', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Account" WHERE "code" = '1004';

-- Backfill: existing JournalLine rows on 「その他の預金」 get tagged as 銀行口座
UPDATE "JournalLine"
SET "subAccountId" = (
  SELECT s."id" FROM "SubAccount" s
  JOIN "Account" a ON a."id" = s."accountId"
  WHERE a."code" = '1004' AND s."name" = '銀行口座'
)
WHERE "accountId" IN (SELECT "id" FROM "Account" WHERE "code" = '1004');
