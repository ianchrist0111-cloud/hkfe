-- CreateTable
CREATE TABLE "CryptoTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "amountUsd" REAL NOT NULL,
    "feeAmount" REAL NOT NULL DEFAULT 0.0,
    "netAmount" REAL NOT NULL DEFAULT 0.0,
    "fromAddress" TEXT,
    "toAddress" TEXT NOT NULL,
    "txHash" TEXT,
    "explorerUrl" TEXT,
    "proofImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "rejectionReason" TEXT,
    "internalNotes" TEXT,
    "slaDueAt" DATETIME,
    "reviewedByAdminId" TEXT,
    "reviewedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CryptoTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformDepositWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "memoOrTag" TEXT,
    "qrCodeUrl" TEXT,
    "minDeposit" REAL NOT NULL DEFAULT 10.0,
    "confirmationsNeeded" INTEGER NOT NULL DEFAULT 2,
    "details" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "paymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramHandle" TEXT DEFAULT '',
    "telegramNumber" TEXT DEFAULT '',
    "telegramUrl" TEXT DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SimulatedWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "totalBalance" REAL NOT NULL DEFAULT 0.0,
    "availableBalance" REAL NOT NULL DEFAULT 0.0,
    "reservedTrading" REAL NOT NULL DEFAULT 0.0,
    "reservedEarn" REAL NOT NULL DEFAULT 0.0,
    "reservedBots" REAL NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SimulatedWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SimulatedWallet" ("availableBalance", "currency", "id", "reservedBots", "reservedEarn", "reservedTrading", "totalBalance", "updatedAt", "userId") SELECT "availableBalance", "currency", "id", "reservedBots", "reservedEarn", "reservedTrading", "totalBalance", "updatedAt", "userId" FROM "SimulatedWallet";
DROP TABLE "SimulatedWallet";
ALTER TABLE "new_SimulatedWallet" RENAME TO "SimulatedWallet";
CREATE UNIQUE INDEX "SimulatedWallet_userId_key" ON "SimulatedWallet"("userId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "dateOfBirth" TEXT,
    "phoneNumber" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'active',
    "kycStatus" TEXT NOT NULL DEFAULT 'not_started',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaBackupCodes" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" DATETIME,
    "tradingBlocked" BOOLEAN NOT NULL DEFAULT false,
    "withdrawalsBlocked" BOOLEAN NOT NULL DEFAULT false,
    "depositsBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "lastLoginIp" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "dateOfBirth", "depositsBlocked", "email", "emailVerified", "emailVerifiedAt", "failedLoginCount", "firstName", "id", "kycStatus", "lastLoginAt", "lastLoginIp", "lastName", "lockedUntil", "mfaBackupCodes", "mfaEnabled", "mfaSecret", "passwordHash", "phoneNumber", "role", "status", "tradingBlocked", "updatedAt", "withdrawalsBlocked") SELECT "createdAt", "dateOfBirth", "depositsBlocked", "email", "emailVerified", "emailVerifiedAt", "failedLoginCount", "firstName", "id", "kycStatus", "lastLoginAt", "lastLoginIp", "lastName", "lockedUntil", "mfaBackupCodes", "mfaEnabled", "mfaSecret", "passwordHash", "phoneNumber", "role", "status", "tradingBlocked", "updatedAt", "withdrawalsBlocked" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CryptoTransaction_txHash_key" ON "CryptoTransaction"("txHash");

-- CreateIndex
CREATE INDEX "CryptoTransaction_userId_idx" ON "CryptoTransaction"("userId");

-- CreateIndex
CREATE INDEX "CryptoTransaction_status_idx" ON "CryptoTransaction"("status");

-- CreateIndex
CREATE INDEX "CryptoTransaction_type_status_idx" ON "CryptoTransaction"("type", "status");

-- CreateIndex
CREATE INDEX "CryptoTransaction_txHash_idx" ON "CryptoTransaction"("txHash");

-- CreateIndex
CREATE INDEX "CryptoTransaction_createdAt_idx" ON "CryptoTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformDepositWallet_address_key" ON "PlatformDepositWallet"("address");
