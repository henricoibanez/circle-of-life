-- CreateTable
CREATE TABLE "maslow_checks" (
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maslow_checks_pkey" PRIMARY KEY ("userId","itemKey")
);

-- CreateTable
CREATE TABLE "maslow_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maslow_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maslow_notes_userId_idx" ON "maslow_notes"("userId");

-- AddForeignKey
ALTER TABLE "maslow_checks" ADD CONSTRAINT "maslow_checks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maslow_notes" ADD CONSTRAINT "maslow_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
