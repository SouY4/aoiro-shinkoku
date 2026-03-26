-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "acquisitionDate" DATETIME NOT NULL,
    "cost" INTEGER NOT NULL,
    "usefulLifeYears" INTEGER NOT NULL,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'straight_line',
    "assetAccountId" INTEGER NOT NULL,
    "expenseAccountId" INTEGER NOT NULL,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FixedAsset_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FixedAsset_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DepreciationRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fixedAssetId" INTEGER NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "journalEntryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepreciationRecord_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepreciationRecord_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fiscalYear" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FixedAsset_assetAccountId_idx" ON "FixedAsset"("assetAccountId");

-- CreateIndex
CREATE INDEX "FixedAsset_expenseAccountId_idx" ON "FixedAsset"("expenseAccountId");

-- CreateIndex
CREATE INDEX "DepreciationRecord_fixedAssetId_idx" ON "DepreciationRecord"("fixedAssetId");

-- CreateIndex
CREATE INDEX "DepreciationRecord_fiscalYear_idx" ON "DepreciationRecord"("fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationRecord_fixedAssetId_fiscalYear_key" ON "DepreciationRecord"("fixedAssetId", "fiscalYear");

-- CreateIndex
CREATE INDEX "InventoryItem_fiscalYear_idx" ON "InventoryItem"("fiscalYear");
