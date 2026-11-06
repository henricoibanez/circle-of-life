-- CreateEnum
CREATE TYPE "GroupRequestKind" AS ENUM ('pedido', 'convite');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'grupo_pedido';
ALTER TYPE "NotificationType" ADD VALUE 'grupo_convite';
ALTER TYPE "NotificationType" ADD VALUE 'grupo_aprovado';
ALTER TYPE "NotificationType" ADD VALUE 'grupo_recusado';

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "private" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "group_requests" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "GroupRequestKind" NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_requests_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateIndex
CREATE INDEX "group_requests_userId_idx" ON "group_requests"("userId");

-- AddForeignKey
ALTER TABLE "group_requests" ADD CONSTRAINT "group_requests_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_requests" ADD CONSTRAINT "group_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
