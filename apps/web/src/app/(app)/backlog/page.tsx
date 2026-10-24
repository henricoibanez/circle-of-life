'use client';

import { Soon } from '@/components/soon';

export default function BacklogPage() {
  return (
    <>
      <header className="sticky z-20 bg-bg/90 px-4 pb-3 pt-4 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <h1 className="text-[32px] font-bold leading-none tracking-tight">Backlog</h1>
        <p className="mt-1.5 text-muted">Sua visão completa em cascata</p>
      </header>
      <Soon icon="backlog" title="Backlog" stage={4} />
    </>
  );
}
