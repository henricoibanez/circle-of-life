-- CreateTable
CREATE TABLE "roda_scores" (
    "userId" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "score" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roda_scores_pkey" PRIMARY KEY ("userId","area")
);

-- CreateTable
CREATE TABLE "roda_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roda_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roda_snapshots_userId_createdAt_idx" ON "roda_snapshots"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "roda_scores" ADD CONSTRAINT "roda_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roda_snapshots" ADD CONSTRAINT "roda_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
