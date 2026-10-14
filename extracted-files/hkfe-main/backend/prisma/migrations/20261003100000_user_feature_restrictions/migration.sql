-- AlterTable
ALTER TABLE "User" ADD COLUMN "tradingBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "withdrawalsBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "depositsBlocked" BOOLEAN NOT NULL DEFAULT false;
