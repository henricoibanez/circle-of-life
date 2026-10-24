-- CreateEnum
CREATE TYPE "AiMode" AS ENUM ('mock', 'anthropic');

-- CreateTable
CREATE TABLE "analysis_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "AiMode" NOT NULL,
    "sources" TEXT[],
    "geral" INTEGER NOT NULL,
    "visao" TEXT NOT NULL,
    "areas" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "imported" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analysis_reports_userId_createdAt_idx" ON "analysis_reports"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "analysis_reports" ADD CONSTRAINT "analysis_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
