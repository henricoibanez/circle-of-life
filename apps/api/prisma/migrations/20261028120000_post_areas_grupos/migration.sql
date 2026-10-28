-- Post com até 3 áreas e vários grupos (decisão do dono de 28/10/2026).
-- Quem vê passa a ser: o que a visibilidade libera + os membros dos grupos.

-- Áreas: a área única vira uma lista.
ALTER TABLE "posts" ADD COLUMN "areas" "Area"[] DEFAULT ARRAY[]::"Area"[];
UPDATE "posts" SET "areas" = ARRAY["area"] WHERE "area" IS NOT NULL;

-- Grupos: tabela de ligação.
CREATE TABLE "post_groups" (
    "postId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "post_groups_pkey" PRIMARY KEY ("postId","groupId")
);
CREATE INDEX "post_groups_groupId_idx" ON "post_groups"("groupId");
ALTER TABLE "post_groups" ADD CONSTRAINT "post_groups_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_groups" ADD CONSTRAINT "post_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "post_groups" ("postId", "groupId") SELECT "id", "groupId" FROM "posts" WHERE "groupId" IS NOT NULL;
-- Antes, post de grupo era visto só pelos membros (a visibilidade era ignorada).
-- Com "privado", continua igual: o autor + os membros do grupo.
UPDATE "posts" SET "visibility" = 'privado' WHERE "groupId" IS NOT NULL;

ALTER TABLE "posts" DROP CONSTRAINT "posts_groupId_fkey";
DROP INDEX "posts_groupId_createdAt_idx";
ALTER TABLE "posts" DROP COLUMN "area",
DROP COLUMN "groupId";
