-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('atividade', 'alertas');

-- CreateEnum
CREATE TYPE "NotificationVolume" AS ENUM ('pouco', 'normal', 'mais');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'tarefas_atrasadas';

-- CreateTable
CREATE TABLE "notification_prefs" (
    "userId" TEXT NOT NULL,
    "volume" "NotificationVolume" NOT NULL DEFAULT 'normal',
    "quietStart" INTEGER NOT NULL DEFAULT 22,
    "quietEnd" INTEGER NOT NULL DEFAULT 8,
    "offBell" "NotificationCategory"[] DEFAULT ARRAY[]::"NotificationCategory"[],
    "offPush" "NotificationCategory"[] DEFAULT ARRAY[]::"NotificationCategory"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_log_userId_sentAt_idx" ON "notification_log"("userId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_log_userId_key_key" ON "notification_log"("userId", "key");

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
