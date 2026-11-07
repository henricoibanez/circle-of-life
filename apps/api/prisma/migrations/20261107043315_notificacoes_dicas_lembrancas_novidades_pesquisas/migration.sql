-- AlterEnum
ALTER TYPE "GemReason" ADD VALUE 'pesquisa';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationCategory" ADD VALUE 'dicas';
ALTER TYPE "NotificationCategory" ADD VALUE 'lembrancas';
ALTER TYPE "NotificationCategory" ADD VALUE 'novidades';
ALTER TYPE "NotificationCategory" ADD VALUE 'pesquisas';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'area_parada';
ALTER TYPE "NotificationType" ADD VALUE 'volte_ao_app';
ALTER TYPE "NotificationType" ADD VALUE 'grupo_sugerido';
ALTER TYPE "NotificationType" ADD VALUE 'algo_bom';
ALTER TYPE "NotificationType" ADD VALUE 'jornada_parada';
ALTER TYPE "NotificationType" ADD VALUE 'lembranca';
ALTER TYPE "NotificationType" ADD VALUE 'novidade';
ALTER TYPE "NotificationType" ADD VALUE 'pesquisa';

-- AlterTable
ALTER TABLE "notification_prefs" ADD COLUMN     "pushAskedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "imageFileId" TEXT;

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_surveyId_userId_key" ON "survey_responses"("surveyId", "userId");

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
