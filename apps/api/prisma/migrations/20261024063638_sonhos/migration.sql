-- CreateTable
CREATE TABLE "dreams" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "imageFileId" TEXT,
    "doneAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dreams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dreams_imageFileId_key" ON "dreams"("imageFileId");

-- CreateIndex
CREATE INDEX "dreams_userId_idx" ON "dreams"("userId");

-- AddForeignKey
ALTER TABLE "dreams" ADD CONSTRAINT "dreams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
