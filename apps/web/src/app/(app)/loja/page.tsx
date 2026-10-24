'use client';

import { Header } from '@/components/header';
import { Soon } from '@/components/soon';

export default function Page() {
  return (
    <>
      <Header title="Loja de trilhas" sub="Encontre trilhas prontas para acelerar sua evolução" info="loja" />
      <Soon icon="bag" title="Loja de trilhas" stage={15} />
    </>
  );
}
