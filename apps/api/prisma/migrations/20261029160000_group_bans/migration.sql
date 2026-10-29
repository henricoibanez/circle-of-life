-- CreateTable
CREATE TABLE "group_bans" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_bans_pkey" PRIMARY KEY ("groupId","userId")
);
-- CreateIndex
CREATE INDEX "group_bans_userId_idx" ON "group_bans"("userId");
-- AddForeignKey
ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
