-- Tarefas de trilha com descrição e áreas próprias (levadas para a tarefa ao importar).
ALTER TABLE "trilha_tasks" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "trilha_tasks" ADD COLUMN "areas" "Area"[] NOT NULL DEFAULT ARRAY[]::"Area"[];

-- Trilha oficial "Primeiros passos" (conteúdo do dono, 04/11/2026): uma ação em
-- cada área da vida. É a trilha recomendada na Jornada de primeiro acesso.
INSERT INTO "trilhas" ("id", "rootId", "authorId", "title", "description", "category", "area", "areas", "art", "color", "coverText", "priceXp", "status", "updatedAt")
VALUES (
  'trilha-primeiros-passos', 'trilha-primeiros-passos', NULL,
  'Primeiros passos',
  'Uma ação simples em cada área da vida para começar a sua primeira sprint.',
  'pessoal', 'emocional',
  ARRAY['emocional', 'amor', 'lazer', 'financas', 'sociedade', 'familia', 'profissional', 'saude', 'intelectual', 'espiritualidade']::"Area"[],
  'sun', '#5e873c', E'PRIMEIROS\nPASSOS', 0, 'aprovada', NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "trilha_tasks" ("id", "trilhaId", "title", "description", "areas", "position") VALUES
  ('trilha-pp-01', 'trilha-primeiros-passos', 'Fazer algo especial com seu par (ou com você mesmo)', 'Exemplos: um jantar, um cinema.', ARRAY['amor']::"Area"[], 0),
  ('trilha-pp-02', 'trilha-primeiros-passos', 'Descobrir e testar um novo hobby', '', ARRAY['lazer']::"Area"[], 1),
  ('trilha-pp-03', 'trilha-primeiros-passos', 'Criar uma caixinha para um sonho do quadro', 'Guarde um valor definido por você para um objetivo do Quadro de visualização. Vale qualquer valor.', ARRAY['financas']::"Area"[], 2),
  ('trilha-pp-04', 'trilha-primeiros-passos', 'Fazer uma doação', 'Para qualquer pessoa ou instituição: tempo, dinheiro ou outra coisa.', ARRAY['sociedade']::"Area"[], 3),
  ('trilha-pp-05', 'trilha-primeiros-passos', 'Passar um dia inteiro desconectado das redes sociais', 'Um dia para estar com você mesmo, livre de um vício eletrônico: séries, redes sociais, notícias etc.', ARRAY['emocional']::"Area"[], 4),
  ('trilha-pp-06', 'trilha-primeiros-passos', 'Recuperar uma lembrança boa e compartilhar com quem estava lá', '', ARRAY['familia']::"Area"[], 5),
  ('trilha-pp-07', 'trilha-primeiros-passos', 'Pesquisar como melhorar uma habilidade', 'Escolha uma hard skill ou soft skill que você julga fraca, pesquise como melhorar e crie uma iniciativa, épico ou tarefa no app.', ARRAY['profissional']::"Area"[], 6),
  ('trilha-pp-08', 'trilha-primeiros-passos', 'Marcar a consulta médica que você está adiando', '', ARRAY['saude']::"Area"[], 7),
  ('trilha-pp-09', 'trilha-primeiros-passos', 'Escolher o seu próximo estudo', 'Um livro, um curso etc.', ARRAY['intelectual']::"Area"[], 8),
  ('trilha-pp-10', 'trilha-primeiros-passos', 'Reservar um momento de silêncio, meditação ou oração', 'Exemplos: meditação guiada 4x4, rezar o terço ou simplesmente não fazer nada.', ARRAY['espiritualidade']::"Area"[], 9)
ON CONFLICT ("id") DO NOTHING;
