-- Tarefa com áreas próprias (até 3). Vazio = herda a área do épico (decisão do dono de 29/10/2026).
ALTER TABLE "tasks" ADD COLUMN "areas" "Area"[] DEFAULT ARRAY[]::"Area"[];
