-- Épico com várias áreas (antes era uma só). A coluna "area" continua sendo a
-- área principal (cor, ícone de capa, categoria); "areas" guarda todas.
-- Decisão do dono de 03/11/2026: sem limite de áreas; a primeira é a principal.
ALTER TABLE "epics" ADD COLUMN "areas" "Area"[] NOT NULL DEFAULT ARRAY[]::"Area"[];
UPDATE "epics" SET "areas" = ARRAY["area"];

-- Trilha (épico publicado) também guarda todas as áreas, para aparecer em todas
-- as áreas dele na loja. "area" segue como a principal (capa e categoria).
ALTER TABLE "trilhas" ADD COLUMN "areas" "Area"[] NOT NULL DEFAULT ARRAY[]::"Area"[];
UPDATE "trilhas" SET "areas" = ARRAY["area"];
