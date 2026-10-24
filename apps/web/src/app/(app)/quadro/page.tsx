'use client';

import { Header } from '@/components/header';
import { Soon } from '@/components/soon';

export default function Page() {
  return (
    <>
      <Header title="Quadro de visualização" sub="Registre seus 10 maiores sonhos de vida" info="quadro" />
      <Soon icon="eye" title="Quadro de visualização" stage={11} />
    </>
  );
}
