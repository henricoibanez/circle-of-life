'use client';

import { Header } from '@/components/header';
import { Soon } from '@/components/soon';

export default function Page() {
  return (
    <>
      <Header title="Relatórios" sub="Acompanhe seu progresso e evolução" info="relatorios" />
      <Soon icon="chart" title="Relatórios" stage={13} />
    </>
  );
}
