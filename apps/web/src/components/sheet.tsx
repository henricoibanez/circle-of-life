'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import { IconBtn } from './primitives';

/**
 * Folha (sheet) do protótipo: sobe de baixo no celular e aparece como janela
 * central no computador. Feita sobre o Dialog do Radix (base do shadcn/ui),
 * que cuida do foco, do Esc e da leitura por leitores de tela.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  icon,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={open => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="sheet-in fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full flex-col rounded-t-[1.75rem] bg-surface outline-none sm:bottom-auto sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:rounded-[1.75rem]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
          <div className="flex items-start gap-3 px-5 pb-2 pt-3">
            {icon}
            <DialogPrimitive.Title className="min-w-0 flex-1 pt-1 text-lg font-bold leading-snug">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconBtn n="x" label="Fechar" box className="-mr-1" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer && <div className="flex gap-2 border-t border-line px-5 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export type Action = { icon: IconName; label: string; run: () => void; danger?: boolean } | false | null | undefined | '';

/** Lista de ações (menu "⋮"), como a ActionSheet do protótipo. */
export function ActionSheet({ title, actions, onClose }: { title: ReactNode; actions: Action[]; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="-mx-1 divide-y divide-line">
        {actions.filter(Boolean).map(a => {
          const action = a as Exclude<Action, false | null | undefined | ''>;
          return (
            <button
              key={action.label}
              onClick={() => {
                onClose();
                action.run();
              }}
              className={`flex w-full items-center gap-3 px-1 py-3.5 text-left text-[0.9375rem] ${action.danger ? 'text-red-600' : ''}`}
            >
              <Icon n={action.icon} className="h-5 w-5" />
              {action.label}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ---------- Pilha de folhas abertas (qualquer tela pode abrir uma) ----------

type Render = (close: () => void) => ReactNode;
type SheetApi = {
  /** Abre uma folha por cima das outras: openSheet(close => <MinhaFolha onClose={close} />). */
  openSheet: (render: Render) => void;
  /** Atalho para um menu de ações. */
  openActions: (title: ReactNode, actions: Action[]) => void;
  closeTop: () => void;
};

const SheetContext = createContext<SheetApi | null>(null);

export function SheetProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<{ id: number; render: Render }[]>([]);
  const next = useRef(0);

  const closeTop = useCallback(() => setStack(s => s.slice(0, -1)), []);
  const openSheet = useCallback((render: Render) => setStack(s => [...s, { id: next.current++, render }]), []);
  const value = useMemo<SheetApi>(
    () => ({
      openSheet,
      closeTop,
      openActions: (title, actions) => openSheet(close => <ActionSheet title={title} actions={actions} onClose={close} />),
    }),
    [openSheet, closeTop],
  );

  return (
    <SheetContext.Provider value={value}>
      {children}
      {stack.map(s => {
        const close = () => setStack(st => st.filter(x => x.id !== s.id));
        return <div key={s.id}>{s.render(close)}</div>;
      })}
    </SheetContext.Provider>
  );
}

export function useSheets() {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useSheets precisa estar dentro do SheetProvider');
  return ctx;
}
