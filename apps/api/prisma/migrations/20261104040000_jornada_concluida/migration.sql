-- Troféu "Jornada concluída" (decisão do dono de 04/11/2026): aparece uma vez,
-- quando a rede social abre, com a apresentação da rede.
ALTER TABLE "users" ADD COLUMN "journeyCelebratedAt" TIMESTAMP(3);
