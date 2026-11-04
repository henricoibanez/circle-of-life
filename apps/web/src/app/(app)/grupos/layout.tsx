'use client';

import type { ReactNode } from 'react';
import { Header } from '@/components/header';
import { SocialLocked } from '@/components/journey';
import { socialLocked } from '@/lib/journey';
import { useMe } from '@/lib/me';

/** Amigos e grupos: trancado enquanto a rede social não abre (Jornada de primeiro acesso). */
export default function GruposLayout({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  if (!me) return null;
  if (socialLocked(me))
    return (
      <>
        <Header title="Amigos e grupos" back={false} />
        <SocialLocked freeAt={me.social.freeAt} />
      </>
    );
  return children;
}
