-- CreateEnum
CREATE TYPE "EmailCodePurpose" AS ENUM ('cadastro', 'senha');
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);
-- CreateTable
CREATE TABLE "email_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "EmailCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "data" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_codes_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "email_codes_email_purpose_idx" ON "email_codes"("email", "purpose");
