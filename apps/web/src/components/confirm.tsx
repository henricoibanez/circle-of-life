'use client';

import { useState, type ReactNode } from 'react';
import { Sheet } from './sheet';
import { Button } from './ui/button';

/** Pede confirmação antes de uma ação que não dá para desfazer (ex.: excluir). */
export function ConfirmSheet({
  title,
  children,
  confirm = 'Confirmar',
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirm?: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className={`flex-1 ${danger ? '!bg-red-600 !text-white' : ''}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } catch {
                setBusy(false);
              }
            }}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <div className="text-[0.9375rem] leading-relaxed text-ink/85">{children}</div>
    </Sheet>
  );
}
