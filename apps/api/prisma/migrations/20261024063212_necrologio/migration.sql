-- CreateTable
CREATE TABLE "necrologios" (
    "userId" TEXT NOT NULL,
    "html" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "necrologios_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "necrologios" ADD CONSTRAINT "necrologios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
