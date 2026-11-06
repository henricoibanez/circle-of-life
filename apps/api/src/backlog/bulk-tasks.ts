import type { Prisma } from '../generated/prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Cria várias tarefas de um épico de uma vez, com a primeira linha do histórico de cada uma.
 * São só 2 consultas ao banco, seja qual for o número de tarefas. Criar uma por uma (com o
 * histórico junto) fazia centenas de idas ao banco: em produção, com o servidor longe do banco,
 * importar uma trilha grande (ex.: 79 tarefas) passava do tempo limite e dava erro.
 */
export async function createTasksInBulk(tx: Tx, epicId: string, tasks: Omit<Prisma.TaskCreateManyInput, 'epicId'>[], logText: string) {
  if (!tasks.length) return [];
  const created = await tx.task.createManyAndReturn({ data: tasks.map(t => ({ ...t, epicId })), select: { id: true } });
  await tx.taskLog.createMany({ data: created.map(t => ({ taskId: t.id, text: logText })) });
  return created;
}
