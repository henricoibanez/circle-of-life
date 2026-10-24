'use client';

import type { AreaId } from '@circle/shared';
import type { ReactNode } from 'react';
import { ConfirmSheet } from '@/components/confirm';
import { useSheets } from '@/components/sheet';
import { EpicForm, InitiativeForm, TaskForm } from './forms';

/** Atalhos para abrir os formulários do backlog e a confirmação de exclusão de qualquer tela. */
export function useBacklogSheets() {
  const { openSheet } = useSheets();

  const openInitiative = (p: { id?: string; areas?: AreaId[] } = {}) => openSheet(close => <InitiativeForm {...p} onClose={close} />);
  const openEpic = (p: { id?: string; initiativeId?: string; title?: string; area?: AreaId } = {}) =>
    openSheet(close => <EpicForm {...p} onClose={close} onNeedInitiative={() => openInitiative()} />);
  const openTask = (p: { id?: string; epicId?: string; title?: string; status?: 'backlog' | 'todo' } = {}) =>
    openSheet(close => <TaskForm {...p} onClose={close} onNeedEpic={() => openEpic()} />);
  const confirmDelete = (title: string, text: ReactNode, run: () => Promise<unknown>) =>
    openSheet(close => (
      <ConfirmSheet title={title} confirm="Excluir" danger onConfirm={run} onClose={close}>
        {text}
      </ConfirmSheet>
    ));

  return { openInitiative, openEpic, openTask, confirmDelete };
}
