'use client';

import { Icon } from '@/components/icon';
import { IconBtn } from '@/components/primitives';
import { Soon } from '@/components/soon';
import { useGoBack } from '@/components/header';

export default function BoardPage() {
  const goBack = useGoBack('/feed');
  return (
    <>
      <header className="sticky z-20 bg-bg/90 px-4 pb-3 pt-3 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3">
          <IconBtn n="chevL" label="Voltar" box onClick={goBack} />
          <span className="text-primary">
            <Icon n="board" className="h-7 w-7" />
          </span>
          <p className="flex-1 text-[22px] font-bold leading-tight">Quadro Kanban</p>
        </div>
      </header>
      <Soon icon="board" title="Quadro Kanban" stage={5} />
    </>
  );
}
