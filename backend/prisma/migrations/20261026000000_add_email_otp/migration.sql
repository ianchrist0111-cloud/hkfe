CREATE TABLE "EmailOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailOtp_email_purpose_key"
ON "EmailOtp"("email", "purpose");

CREATE INDEX "EmailOtp_expiresAt_idx"
ON "EmailOtp"("expiresAt");
