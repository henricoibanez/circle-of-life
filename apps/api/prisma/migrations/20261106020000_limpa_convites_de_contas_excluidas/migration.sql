-- Convites aceitos por contas que já foram excluídas (o aceitante virou NULL ao apagar a conta).
-- Eles apareciam como "aceito" e impediam um convite novo. A partir de agora, excluir a conta
-- apaga o convite junto (decisão do dono de 06/11/2026); aqui limpamos os que já existiam.
DELETE FROM "invites" WHERE "acceptedAt" IS NOT NULL AND "acceptedUserId" IS NULL;
