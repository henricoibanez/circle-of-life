-- Jornada de primeiro acesso (decisão do dono de 03/11/2026). Quem já usa o
-- app fica com journey = false: nada muda para essas pessoas.
ALTER TABLE "users" ADD COLUMN "journey" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "journeyWelcomedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "minhaVidaAt" TIMESTAMP(3);
