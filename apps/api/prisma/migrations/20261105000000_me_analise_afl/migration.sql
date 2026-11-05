-- "Me analise" novo (decisão do dono de 05/11/2026): IA pelo agente do Agents for Life
-- e relatório no formato retrato, padrões, gaps, recomendações e padrões limitantes.
ALTER TYPE "AiMode" ADD VALUE 'afl';

ALTER TABLE "analysis_reports" ADD COLUMN "details" JSONB;
