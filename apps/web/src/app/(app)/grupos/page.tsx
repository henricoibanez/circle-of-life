'use client';

import { Header } from '@/components/header';
import { Soon } from '@/components/soon';

export default function Page() {
  return (
    <>
      <Header title="Amigos e grupos" sub="Conecte-se, compartilhe e evolua junto" info="grupos" />
      <Soon icon="users" title="Amigos e grupos" stage={16} />
    </>
  );
}
