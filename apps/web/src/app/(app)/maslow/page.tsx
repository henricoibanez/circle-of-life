'use client';

import { Header } from '@/components/header';
import { Soon } from '@/components/soon';

export default function Page() {
  return (
    <>
      <Header title="Pirâmide de Maslow" sub="Seu progresso em direção à autorrealização" info="maslow" />
      <Soon icon="triangle" title="Pirâmide de Maslow" stage={9} />
    </>
  );
}
