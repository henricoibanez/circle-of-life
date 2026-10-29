-- AlterTable
ALTER TABLE "sprints" ALTER COLUMN "plannedEnd" DROP NOT NULL;
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sprintLength" INTEGER NOT NULL DEFAULT 14;
