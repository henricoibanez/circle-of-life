-- Sprint manual (decisão do dono de 03/11/2026): a pessoa dá nome, descrição e
-- duração, e aperta "Iniciar sprint". Sprint sem startAt = em planejamento.
ALTER TABLE "sprints" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "sprints" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "sprints" ADD COLUMN "length" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "sprints" ADD COLUMN "offSprintWarned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sprints" ADD COLUMN "deadlineNotifiedAt" TIMESTAMP(3);
ALTER TABLE "sprints" ALTER COLUMN "startAt" DROP NOT NULL;

-- A duração deixa as Configurações e passa a ser de cada sprint: as sprints
-- existentes herdam a duração que a pessoa tinha escolhido.
UPDATE "sprints" s SET "length" = u."sprintLength" FROM "users" u WHERE u."id" = s."userId";
ALTER TABLE "users" DROP COLUMN "sprintLength";

-- Avisos novos: sprint iniciada e prazo da sprint vencido.
ALTER TYPE "NotificationType" ADD VALUE 'sprint_iniciada';
ALTER TYPE "NotificationType" ADD VALUE 'sprint_prazo';
