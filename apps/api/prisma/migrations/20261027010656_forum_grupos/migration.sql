-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'grupo_topico';
ALTER TYPE "NotificationType" ADD VALUE 'grupo_resposta';

-- CreateTable
CREATE TABLE "group_topics" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_replies" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_topics_groupId_lastActivityAt_idx" ON "group_topics"("groupId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "group_replies_topicId_createdAt_idx" ON "group_replies"("topicId", "createdAt");

-- AddForeignKey
ALTER TABLE "group_topics" ADD CONSTRAINT "group_topics_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_topics" ADD CONSTRAINT "group_topics_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_replies" ADD CONSTRAINT "group_replies_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "group_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_replies" ADD CONSTRAINT "group_replies_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
