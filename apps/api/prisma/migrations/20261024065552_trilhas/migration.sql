-- CreateEnum
CREATE TYPE "TrilhaStatus" AS ENUM ('pendente', 'aprovada', 'recusada', 'despublicada');

-- CreateTable
CREATE TABLE "trilhas" (
    "id" TEXT NOT NULL,
    "rootId" TEXT NOT NULL,
    "replacesId" TEXT,
    "authorId" TEXT,
    "sourceInitiativeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "areas" "Area"[],
    "coverFileId" TEXT,
    "art" TEXT NOT NULL DEFAULT 'lake',
    "color" TEXT NOT NULL DEFAULT '#5e873c',
    "coverText" TEXT,
    "priceXp" INTEGER NOT NULL DEFAULT 0,
    "status" "TrilhaStatus" NOT NULL DEFAULT 'pendente',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "baseDownloads" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trilhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trilha_epics" (
    "id" TEXT NOT NULL,
    "trilhaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "trilha_epics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trilha_tasks" (
    "id" TEXT NOT NULL,
    "trilhaEpicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "trilha_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trilha_favorites" (
    "userId" TEXT NOT NULL,
    "trilhaId" TEXT NOT NULL,

    CONSTRAINT "trilha_favorites_pkey" PRIMARY KEY ("userId","trilhaId")
);

-- CreateTable
CREATE TABLE "trilha_acquisitions" (
    "userId" TEXT NOT NULL,
    "trilhaId" TEXT NOT NULL,
    "rootId" TEXT NOT NULL,
    "xpPaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trilha_acquisitions_pkey" PRIMARY KEY ("userId","trilhaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "trilhas_coverFileId_key" ON "trilhas"("coverFileId");

-- CreateIndex
CREATE INDEX "trilhas_status_idx" ON "trilhas"("status");

-- CreateIndex
CREATE INDEX "trilhas_rootId_idx" ON "trilhas"("rootId");

-- CreateIndex
CREATE INDEX "trilha_acquisitions_rootId_idx" ON "trilha_acquisitions"("rootId");

-- AddForeignKey
ALTER TABLE "trilhas" ADD CONSTRAINT "trilhas_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trilha_epics" ADD CONSTRAINT "trilha_epics_trilhaId_fkey" FOREIGN KEY ("trilhaId") REFERENCES "trilhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trilha_tasks" ADD CONSTRAINT "trilha_tasks_trilhaEpicId_fkey" FOREIGN KEY ("trilhaEpicId") REFERENCES "trilha_epics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trilha_favorites" ADD CONSTRAINT "trilha_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trilha_favorites" ADD CONSTRAINT "trilha_favorites_trilhaId_fkey" FOREIGN KEY ("trilhaId") REFERENCES "trilhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trilha_acquisitions" ADD CONSTRAINT "trilha_acquisitions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trilha_acquisitions" ADD CONSTRAINT "trilha_acquisitions_trilhaId_fkey" FOREIGN KEY ("trilhaId") REFERENCES "trilhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
