'use client';

import { useEffect, useState } from 'react';

type Check = { ok: boolean; erro?: string };
type Health = { api: Check; banco: Check; storage: Check };

const LABELS: Record<keyof Health, string> = { api: 'API', banco: 'Banco de dados', storage: 'Storage de arquivos' };

/** Pergunta à API (pelo próprio site, em /api/health) se tudo está no ar. */
export function HealthStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then((data: Health & { message?: Health }) => setHealth(data.api ? data : (data.message ?? null)))
      .catch(() => setOffline(true));
  }, []);

  if (offline) return <p className="text-red-600">Não foi possível falar com a API.</p>;
  if (!health) return <p className="opacity-60">Verificando…</p>;

  return (
    <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-white">
      {(Object.keys(LABELS) as (keyof Health)[]).map(k => (
        <li key={k} className="flex items-center gap-3 px-4 py-3">
          <span className={`h-2.5 w-2.5 rounded-full ${health[k]?.ok ? 'bg-green-600' : 'bg-red-600'}`} />
          <span className="flex-1">{LABELS[k]}</span>
          <span className="text-sm opacity-70">{health[k]?.ok ? 'Funcionando' : (health[k]?.erro ?? 'Fora do ar')}</span>
        </li>
      ))}
    </ul>
  );
}
