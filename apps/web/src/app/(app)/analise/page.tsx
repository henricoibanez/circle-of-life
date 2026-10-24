'use client';

import { Header } from '@/components/header';
import { Soon } from '@/components/soon';

export default function Page() {
  return (
    <>
      <Header title="Análise inteligente da sua vida" sub="A IA cruza os seus exercícios com o que você executa." info="analise" />
      <Soon icon="sparkles" title="Análise inteligente da sua vida" stage={19} />
    </>
  );
}
