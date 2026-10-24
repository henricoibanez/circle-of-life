'use client';

import { Header } from '@/components/header';
import { Avatar, Card } from '@/components/primitives';
import { Soon } from '@/components/soon';
import { Button } from '@/components/ui/button';
import { logout } from '@/lib/api';
import { useMe } from '@/lib/me';
import { HealthStatus } from '../health-status';

// Provisória: o perfil completo (foto, temas, estatísticas) chega na etapa 12.
export default function PerfilPage() {
  const { data: me } = useMe();
  return (
    <>
      <Header title="Meu Perfil" sub="Sua jornada, seu progresso, sua vida." />
      <div className="space-y-4 px-4">
        {me && (
          <Card className="flex items-center gap-4 p-4">
            <Avatar name={me.name} photo={me.photoUrl} size="w-16 h-16 text-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{me.name}</p>
              <p className="truncate text-sm text-muted">{me.email}</p>
              <p className="text-sm text-muted">ID: @{me.handle}</p>
            </div>
          </Card>
        )}
        <Soon icon="user" title="Perfil completo" stage={12} />
        <div className="space-y-2">
          <p className="px-1 text-sm font-semibold text-muted">Estado do sistema</p>
          <HealthStatus />
        </div>
        <Button variant="line" className="w-full" onClick={logout}>
          Sair da conta
        </Button>
      </div>
    </>
  );
}
