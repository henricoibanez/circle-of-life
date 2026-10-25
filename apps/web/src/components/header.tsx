'use client';

import { INFO } from '@circle/shared';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconBtn } from './primitives';
import { Sheet, useSheets } from './sheet';

/** Folha com a explicação de uma ferramenta (botão "i"). */
export function InfoSheet({ k, onClose }: { k: string; onClose: () => void }) {
  const [title, paragraphs] = INFO[k] ?? ['', []];
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-3 text-[0.9375rem] leading-relaxed text-ink/85">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </Sheet>
  );
}

/** Volta para a tela anterior; sem histórico, vai para `fallback`. */
export function useGoBack(fallback = '/mais') {
  const router = useRouter();
  return () => (window.history.length > 1 ? router.back() : router.push(fallback));
}

/** Cabeçalho das telas internas: voltar, título centralizado e botão "i" (ou outro à direita). */
export function Header({
  title,
  sub,
  info,
  right,
  back = true,
  fallback,
}: {
  title: string;
  sub?: string;
  info?: string;
  right?: ReactNode;
  back?: boolean;
  fallback?: string;
}) {
  const goBack = useGoBack(fallback);
  const { openSheet } = useSheets();
  return (
    <header className="sticky z-20 bg-bg/90 px-4 pb-3 pt-3 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-center gap-3">
        <div className="w-11">{back && <IconBtn n="arrowL" label="Voltar" box onClick={goBack} />}</div>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-[1.375rem] font-bold leading-tight tracking-tight">{title}</h1>
          {sub && <p className="mt-0.5 text-[0.8125rem] text-muted">{sub}</p>}
        </div>
        <div className="flex w-11 justify-end">
          {right || (info && <IconBtn n="info" label="Sobre esta tela" onClick={() => openSheet(close => <InfoSheet k={info} onClose={close} />)} />)}
        </div>
      </div>
    </header>
  );
}
