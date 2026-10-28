-- Trilha passa a ser UM épico (com as tarefas), e pode pertencer a um grupo.
-- Os dados existentes são convertidos:
--   1. cada trilha com vários épicos vira uma trilha por épico (o primeiro épico fica com o id,
--      os favoritos e as versões da trilha original; quem já tinha adquirido continua com todas);
--   2. cada trilha que estava num grupo vira uma cópia que pertence ao grupo.

ALTER TYPE "NotificationType" ADD VALUE 'grupo_trilha_sugerida';
ALTER TYPE "NotificationType" ADD VALUE 'grupo_gestor';

-- Colunas novas (preenchidas abaixo antes de virarem obrigatórias).
DROP INDEX "trilhas_coverFileId_key";
ALTER TABLE "trilhas"
ADD COLUMN "area" "Area",
ADD COLUMN "copiedFromId" TEXT,
ADD COLUMN "groupId" TEXT,
ADD COLUMN "sourceEpicId" TEXT;
ALTER TABLE "trilha_tasks" ADD COLUMN "trilhaId" TEXT;
ALTER TABLE "trilha_tasks" ALTER COLUMN "trilhaEpicId" DROP NOT NULL;

CREATE FUNCTION pg_temp.new_id() RETURNS TEXT AS $$
  SELECT 'm' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)
$$ LANGUAGE SQL;

-- 1. Uma trilha por épico.
DO $$
DECLARE
  t RECORD;
  e RECORD;
  n INT;
  first BOOLEAN;
  nid TEXT;
BEGIN
  FOR t IN SELECT * FROM "trilhas" LOOP
    SELECT count(*) INTO n FROM "trilha_epics" WHERE "trilhaId" = t."id";
    first := TRUE;
    FOR e IN SELECT * FROM "trilha_epics" WHERE "trilhaId" = t."id" ORDER BY "position" LOOP
      IF first THEN
        UPDATE "trilhas" SET "area" = e."area", "title" = CASE WHEN n > 1 THEN e."title" ELSE t."title" END WHERE "id" = t."id";
        UPDATE "trilha_tasks" SET "trilhaId" = t."id" WHERE "trilhaEpicId" = e."id";
        first := FALSE;
      ELSE
        nid := pg_temp.new_id();
        INSERT INTO "trilhas" ("id", "rootId", "authorId", "title", "description", "category", "area", "coverFileId", "art", "color", "priceXp", "status",
          "reviewedById", "reviewedAt", "rejectionReason", "baseDownloads", "createdAt", "updatedAt")
        VALUES (nid, nid, t."authorId", e."title", t."description", t."category", e."area", t."coverFileId", t."art", t."color", t."priceXp", t."status",
          t."reviewedById", t."reviewedAt", t."rejectionReason", t."baseDownloads", t."createdAt", t."updatedAt");
        UPDATE "trilha_tasks" SET "trilhaId" = nid WHERE "trilhaEpicId" = e."id";
        INSERT INTO "trilha_acquisitions" ("userId", "trilhaId", "rootId", "xpPaid", "createdAt")
          SELECT "userId", nid, nid, 0, "createdAt" FROM "trilha_acquisitions" WHERE "trilhaId" = t."id";
        INSERT INTO "group_trilhas" ("groupId", "trilhaId", "addedById", "addedAt")
          SELECT "groupId", nid, "addedById", "addedAt" FROM "group_trilhas" WHERE "trilhaId" = t."id";
      END IF;
    END LOOP;
    IF first THEN
      UPDATE "trilhas" SET "area" = COALESCE(t."areas"[1], 'intelectual') WHERE "id" = t."id";
    END IF;
  END LOOP;
END $$;

-- 2. Trilhas que estavam nos grupos viram cópias do grupo.
DO $$
DECLARE
  l RECORD;
  nid TEXT;
BEGIN
  FOR l IN SELECT g."groupId", g."addedById", g."addedAt", t.* FROM "group_trilhas" g JOIN "trilhas" t ON t."id" = g."trilhaId" LOOP
    nid := pg_temp.new_id();
    INSERT INTO "trilhas" ("id", "rootId", "authorId", "groupId", "copiedFromId", "title", "description", "category", "area", "coverFileId", "art", "color",
      "coverText", "priceXp", "status", "reviewedById", "reviewedAt", "createdAt", "updatedAt")
    VALUES (nid, nid, l."authorId", l."groupId", l."id", l."title", l."description", l."category", l."area", l."coverFileId", l."art", l."color",
      l."coverText", 0, 'aprovada', l."addedById", l."addedAt", l."addedAt", l."addedAt");
    INSERT INTO "trilha_tasks" ("id", "trilhaId", "title", "position")
      SELECT pg_temp.new_id(), nid, "title", "position" FROM "trilha_tasks" WHERE "trilhaId" = l."id";
  END LOOP;
END $$;

-- Remove o que não é mais usado e torna obrigatório o que foi preenchido.
ALTER TABLE "group_trilhas" DROP CONSTRAINT "group_trilhas_groupId_fkey";
ALTER TABLE "group_trilhas" DROP CONSTRAINT "group_trilhas_trilhaId_fkey";
ALTER TABLE "trilha_epics" DROP CONSTRAINT "trilha_epics_trilhaId_fkey";
ALTER TABLE "trilha_tasks" DROP CONSTRAINT "trilha_tasks_trilhaEpicId_fkey";
DROP TABLE "group_trilhas";
DROP TABLE "trilha_epics";

DELETE FROM "trilha_tasks" WHERE "trilhaId" IS NULL;
ALTER TABLE "trilha_tasks" DROP COLUMN "trilhaEpicId";
ALTER TABLE "trilha_tasks" ALTER COLUMN "trilhaId" SET NOT NULL;

ALTER TABLE "trilhas" DROP COLUMN "areas", DROP COLUMN "sourceInitiativeId";
ALTER TABLE "trilhas" ALTER COLUMN "area" SET NOT NULL;

CREATE INDEX "trilhas_groupId_idx" ON "trilhas"("groupId");
ALTER TABLE "trilhas" ADD CONSTRAINT "trilhas_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trilha_tasks" ADD CONSTRAINT "trilha_tasks_trilhaId_fkey" FOREIGN KEY ("trilhaId") REFERENCES "trilhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
