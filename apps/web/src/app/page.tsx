'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, logout, type Me } from '@/lib/api';
import { HealthStatus } from './health-status';

// Página provisória: as telas de verdade (Feed, Board, Backlog, Mais) chegam na etapa 3.
export default function Home() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>('/me')
      .then(setMe)
      .catch(e => {
        if (e instanceof ApiError && e.status === 401) window.location.href = '/login';
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4">
      <h1 className="text-4xl tracking-tight">
        <span className="font-semibold text-primary">Circle</span> <span className="text-muted">of</span>{' '}
        <span className="font-semibold text-primary">Life</span>
      </h1>
      {me && (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <div className="flex-1">
            <p className="font-semibold">Olá, {me.name.split(' ')[0]}!</p>
            <p className="text-sm text-muted">
              {me.email} · @{me.handle} · {me.xp.total.toLocaleString('pt-BR')} XP
            </p>
          </div>
          {me.role === 'admin' && (
            <Link href="/admin/convites" className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              Convites
            </Link>
          )}
          <button onClick={logout} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-sunk">
            Sair
          </button>
        </div>
      )}
      <HealthStatus />
    </main>
  );
}
