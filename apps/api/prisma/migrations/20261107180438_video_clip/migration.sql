-- AlterTable
ALTER TABLE "post_media" ADD COLUMN     "clipEnd" DOUBLE PRECISION,
ADD COLUMN     "clipStart" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "clipEnd" DOUBLE PRECISION,
ADD COLUMN     "clipStart" DOUBLE PRECISION;
