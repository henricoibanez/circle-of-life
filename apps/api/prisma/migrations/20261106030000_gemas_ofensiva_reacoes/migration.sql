-- Gemas, a moeda do app (decisão do dono de 06/11/2026): a loja passa a cobrar em gemas,
-- o XP deixa de ser gasto. Todo mundo começa com 0 gemas; os preços das trilhas mantêm o número.
CREATE TYPE "GemReason" AS ENUM ('jornada', 'sprint', 'ofensiva', 'trilha_compra', 'rede_social');
CREATE TYPE "ReactionKind" AS ENUM ('like', 'dislike', 'heart');

ALTER TABLE "users" DROP COLUMN "xpSpent";
ALTER TABLE "users" ADD COLUMN "gems" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trilhas" RENAME COLUMN "priceXp" TO "priceGems";
ALTER TABLE "trilha_acquisitions" RENAME COLUMN "xpPaid" TO "gemsPaid";

CREATE TABLE "gem_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "GemReason" NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gem_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "gem_events_userId_reason_refId_idx" ON "gem_events"("userId", "reason", "refId");
ALTER TABLE "gem_events" ADD CONSTRAINT "gem_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dias de acesso (ofensiva e acessos do mês).
CREATE TABLE "user_login_days" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_login_days_pkey" PRIMARY KEY ("userId","day")
);
ALTER TABLE "user_login_days" ADD CONSTRAINT "user_login_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reações em comentários e stories (curtir, não curtir, coração).
CREATE TABLE "comment_reactions" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ReactionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("commentId","userId")
);
CREATE INDEX "comment_reactions_commentId_idx" ON "comment_reactions"("commentId");
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "story_likes" ADD COLUMN "kind" "ReactionKind" NOT NULL DEFAULT 'like';
