'use client';

import { use, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Check = { email: string; status: 'pendente' | 'aceito' | 'expirado' };

/** Tela aberta pelo link do e-mail de convite. */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invite, setInvite] = useState<Check | null>(null);
  const [error, setError] = useState('');
  const [googleOn, setGoogleOn] = useState(true);
  const [senhaOn, setSenhaOn] = useState(false);

  useEffect(() => {
    api<Check>(`/invites/check/${encodeURIComponent(token)}`)
      .then(setInvite)
      .catch(e => setError(e instanceof ApiError ? e.message : 'Não foi possível abrir o convite.'));
    api<{ google: boolean; senha: boolean }>('/auth/providers').then(p => {
      setGoogleOn(p.google);
      setSenhaOn(p.senha);
    });
  }, [token]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10 text-center">
      <p className="text-[1.875rem] tracking-tight">
        <span className="font-semibold text-primary">Circle</span> <span className="text-muted">of</span>{' '}
        <span className="font-semibold text-primary">Life</span>
      </p>

      {!invite && !error && <p className="text-muted">Abrindo o convite…</p>}
      {error && <p className="rounded-2xl bg-red-500/5 px-4 py-3 text-red-700">{error}</p>}

      {invite?.status === 'pendente' && (
        <>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Você foi convidado</h1>
            <p className="text-muted">
              Para entrar, use <strong className="text-ink">{invite.email}</strong>: com a conta Google desse e-mail{senhaOn ? ' ou criando uma senha' : ''}.
            </p>
          </div>
          <a
            href={googleOn ? `/api/auth/google?invite=${encodeURIComponent(token)}` : undefined}
            aria-disabled={!googleOn}
            className={`rounded-xl bg-primary px-4 py-3 font-semibold text-onprimary ${googleOn ? 'hover:opacity-90' : 'pointer-events-none opacity-50'}`}
          >
            Aceitar convite e entrar com Google
          </a>
          {senhaOn && (
            <a
              href={`/login?criar=1&email=${encodeURIComponent(invite.email)}`}
              className="rounded-xl border border-line bg-surface px-4 py-3 font-semibold hover:bg-sunk"
            >
              Criar conta com e-mail e senha
            </a>
          )}
          {!googleOn && <p className="text-xs text-muted">Login com Google ainda não configurado neste ambiente.</p>}
        </>
      )}
      {invite?.status === 'aceito' && (
        <>
          <p className="text-muted">Este convite já foi usado.</p>
          <a href="/login" className="font-semibold text-primary">Ir para o login</a>
        </>
      )}
      {invite?.status === 'expirado' && <p className="text-muted">Este convite expirou. Peça um novo a quem te convidou.</p>}
    </main>
  );
}
