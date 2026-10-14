-- AlterTable
ALTER TABLE "Trade" ADD COLUMN "durationSeconds" INTEGER;
ALTER TABLE "Trade" ADD COLUMN "targetExpiry" DATETIME;
ALTER TABLE "Trade" ADD COLUMN "payoutRate" REAL DEFAULT 0.90;
ALTER TABLE "Trade" ADD COLUMN "strikePrice" REAL;
