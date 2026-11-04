-- Jornada em 7 fases (decisão do dono de 04/11/2026): o bônus sai ao apertar
-- "Concluir minha jornada" e a rede abre por 500 XP ou de graça depois de 7 dias.
ALTER TABLE "users" ADD COLUMN "journeyPhaseSeen" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "journeyFinishedAt" TIMESTAMP(3);
-- O início da 1ª sprint não conta mais prazo nenhum.
ALTER TABLE "users" DROP COLUMN "firstSprintAt";
