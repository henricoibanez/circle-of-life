'use client';

import { Header } from '@/components/header';
import { Soon } from '@/components/soon';

export default function Page() {
  return (
    <>
      <Header title="Roda da Vida" sub="Avalie cada área da sua vida de 0 a 10" info="roda" />
      <Soon icon="wheel" title="Roda da Vida" stage={8} />
    </>
  );
}
