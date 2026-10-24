'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from './icon';
import { Sheet, useSheets } from './sheet';
import { useToast } from './toasts';

const TABS: { href: string; icon: IconName; label: string }[] = [
  { href: '/feed', icon: 'home', label: 'Feed' },
  { href: '/board', icon: 'board', label: 'Board' },
  { href: '/backlog', icon: 'backlog', label: 'Backlog' },
  { href: '/mais', icon: 'grid', label: 'Mais' },
];

/** Barra inferior do protótipo: Feed, Board, botão "+", Backlog e Mais. */
export function BottomNav() {
  const path = usePathname();
  const { openSheet } = useSheets();
  // "Mais" fica marcado também nas telas que se abrem a partir dele.
  const active = TABS.find(t => path.startsWith(t.href))?.href ?? '/mais';

  const tab = (t: (typeof TABS)[number]) => {
    const on = active === t.href;
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={on ? 'page' : undefined}
        className={`mx-1 flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[12px] font-medium ${on ? 'bg-primary/10 text-primary' : 'text-ink/70'}`}
      >
        <Icon n={t.icon} className="h-6 w-6" sw={1.7} />
        {t.label}
      </Link>
    );
  };

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-2xl items-center rounded-[28px] border border-line/80 bg-surface/95 px-1 py-1.5 shadow-soft backdrop-blur-md">
        {tab(TABS[0]!)}
        {tab(TABS[1]!)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={() => openSheet(close => <AddSheet onClose={close} />)}
            aria-label="Adicionar"
            className="-mt-7 grid h-[60px] w-[60px] place-items-center rounded-full bg-primary text-onprimary shadow-lg shadow-primary/30 ring-[5px] ring-bg"
          >
            <Icon n="plus" className="h-8 w-8" sw={2.2} />
          </button>
        </div>
        {tab(TABS[2]!)}
        {tab(TABS[3]!)}
      </div>
    </nav>
  );
}

/** Folha do botão "+": escolher o que criar. */
export function AddSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const opts: { n: IconName; title: string; d: string; bg: string; ic: string; stage: number }[] = [
    { n: 'target', title: 'Nova Iniciativa', d: 'Objetivo estratégico de alto nível', bg: 'bg-primary/5', ic: 'bg-primary text-onprimary', stage: 4 },
    { n: 'layersArea', title: 'Novo Épico', d: 'Conjunto de entregáveis relacionados', bg: 'bg-accent/5', ic: 'bg-accent text-white', stage: 4 },
    { n: 'checkSq', title: 'Nova Tarefa', d: 'Ação específica e executável', bg: 'bg-sunk/60', ic: 'bg-emerald-600 text-white', stage: 4 },
    { n: 'edit', title: 'Novo post', d: 'Compartilhar algo no feed', bg: 'bg-sunk/60', ic: 'bg-ink text-bg', stage: 17 },
  ];
  return (
    <Sheet title="Adicionar" onClose={onClose} footer={<Button variant="line" className="flex-1" onClick={onClose}>Cancelar</Button>}>
      <div className="space-y-3">
        {opts.map(o => (
          <button
            key={o.title}
            onClick={() => {
              onClose();
              toast(`${o.title}: chega na etapa ${o.stage}`);
            }}
            className={`flex w-full items-center gap-4 rounded-2xl border border-line p-4 text-left hover:border-primary/40 ${o.bg}`}
          >
            <span className={`grid h-12 w-12 place-items-center rounded-full ${o.ic}`}>
              <Icon n={o.n} />
            </span>
            <span>
              <span className="block text-[17px] font-semibold">{o.title}</span>
              <span className="block text-sm text-muted">{o.d}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
