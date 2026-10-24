'use client';

import Link from 'next/link';
import { Logo, Wordmark } from '@/components/art';
import { Icon } from '@/components/icon';
import { Soon } from '@/components/soon';

export default function FeedPage() {
  return (
    <>
      <header className="sticky z-20 flex items-center gap-2.5 bg-bg/90 px-4 pb-2 pt-3 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <Logo className="h-10 w-10" />
        <Wordmark className="flex-1 text-[24px]" />
        <Link href="/notificacoes" aria-label="Notificações" className="relative grid h-10 w-10 place-items-center text-ink/80">
          <Icon n="bell" className="h-6 w-6" />
        </Link>
      </header>
      <Soon icon="home" title="Feed" stage={17}>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">Aqui vão aparecer os stories e os posts seus, dos seus amigos e dos seus grupos.</p>
      </Soon>
    </>
  );
}
