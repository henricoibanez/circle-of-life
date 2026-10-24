'use client';

import { Header } from '@/components/header';
import { Soon } from '@/components/soon';

export default function Page() {
  return (
    <>
      <Header title="Notificações" sub="Pedidos de amizade, curtidas, comentários e avisos" />
      <Soon icon="bell" title="Notificações" stage={14} />
    </>
  );
}
