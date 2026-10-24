'use client';

import { Header } from '@/components/header';
import { Soon } from '@/components/soon';

export default function Page() {
  return (
    <>
      <Header title="Necrológio" sub="Escreva sobre o legado que deseja deixar." info="necro" />
      <Soon icon="feather" title="Necrológio" stage={10} />
    </>
  );
}
