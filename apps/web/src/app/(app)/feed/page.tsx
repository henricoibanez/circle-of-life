'use client';

import { Logo, Wordmark } from '@/components/art';
import { Bell } from '@/components/bell';
import { Soon } from '@/components/soon';

export default function FeedPage() {
  return (
    <>
      <header className="sticky z-20 flex items-center gap-2.5 bg-bg/90 px-4 pb-2 pt-3 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <Logo className="h-10 w-10" />
        <Wordmark className="flex-1 text-[24px]" />
        <Bell />
      </header>
      <Soon icon="home" title="Feed" stage={17}>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">Aqui vão aparecer os stories e os posts seus, dos seus amigos e dos seus grupos.</p>
      </Soon>
    </>
  );
}
