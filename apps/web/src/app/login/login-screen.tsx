'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Providers = { google: boolean; dev: boolean; convite: boolean };
type DevUser = { id: string; name: string; email: string; role: 'member' | 'admin' };

/** Mensagens para cada motivo de recusa que a API devolve em ?erro=. */
const ERRORS: Record<string, string> = {
  'sem-convite': 'O Circle of Life está em fase de testes e o acesso é só por convite. Peça um convite a um administrador.',
  'convite-outro-email': 'Esse convite é para outro e-mail. Entre com a conta Google do e-mail que recebeu o convite.',
  'email-nao-verificado': 'O e-mail dessa conta Google não está verificado. Use outra conta.',
  'google-indisponivel': 'O login com Google ainda não está configurado neste ambiente.',
  'google-falhou': 'Não foi possível entrar com o Google. Tente de novo.',
  'estado-invalido': 'O login expirou ou foi interrompido. Tente de novo.',
};

export function LoginScreen() {
  const erro = useSearchParams().get('erro');
  const [providers, setProviders] = useState<Providers | null>(null);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<Providers>('/auth/providers').then(p => {
      setProviders(p);
      if (p.dev) api<DevUser[]>('/auth/dev/users').then(setDevUsers);
    });
  }, []);

  const devLogin = async (id: string) => {
    setBusy(id);
    await api('/auth/dev/login', { method: 'POST', body: { userId: id } });
    window.location.href = '/';
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="text-center">
        <p className="text-[34px] tracking-tight">
          <span className="font-semibold text-primary">Circle</span> <span className="text-muted">of</span>{' '}
          <span className="font-semibold text-primary">Life</span>
        </p>
        <p className="mt-2 text-muted">Planeje e execute a sua vida em sprints.</p>
      </div>

      {erro && (
        <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">
          {ERRORS[erro] ?? ERRORS['google-falhou']}
        </p>
      )}

      <div className="space-y-3">
        <a
          href={providers?.google ? '/api/auth/google' : undefined}
          aria-disabled={!providers?.google}
          className={`flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 font-semibold shadow-soft ${
            providers?.google ? 'hover:bg-sunk' : 'pointer-events-none opacity-50'
          }`}
        >
          <GoogleIcon />
          Entrar com Google
        </a>
        {providers && !providers.google && (
          <p className="text-center text-xs text-muted">Login com Google ainda não configurado neste ambiente.</p>
        )}
        {providers?.convite && <p className="text-center text-xs text-muted">Acesso só por convite, nesta fase de testes.</p>}
      </div>

      {providers?.dev && (
        <section className="rounded-2xl border border-dashed border-line p-4">
          <h2 className="text-sm font-semibold">Login de desenvolvimento</h2>
          <p className="mb-3 text-xs text-muted">Só aparece no ambiente local. Entre como um usuário de teste:</p>
          <ul className="divide-y divide-line">
            {devUsers.map(u => (
              <li key={u.id}>
                <button
                  onClick={() => devLogin(u.id)}
                  disabled={busy !== null}
                  className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-onprimary">
                    {u.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{u.name}</span>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                  </span>
                  {u.role === 'admin' && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Admin</span>}
                  {busy === u.id && <span className="text-xs text-muted">Entrando…</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" />
    </svg>
  );
}
