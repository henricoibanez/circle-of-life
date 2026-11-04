-- Jornada, etapa 3 (decisão do dono de 03/11/2026): bônus "Primeiros passos"
-- ao iniciar a 1ª sprint e rede social trancada (abre 30 dias depois, ou por XP).
ALTER TABLE "users" ADD COLUMN "firstSprintAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "socialUnlockedAt" TIMESTAMP(3);

ALTER TYPE "XpReason" ADD VALUE 'primeiros_passos';
ALTER TYPE "XpReason" ADD VALUE 'rede_social';
