'use client';

import { Header } from '@/components/header';
import { inputCls } from '@/components/primitives';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Invite = {
  id: string;
  email: string;
  status: 'pendente' | 'aceito' | 'expirado';
  convidadoPor: string;
  aceitoPor: string | null;
  criadoEm: string;
  expiraEm: string;
};

const STATUS: Record<Invite['status'], [string, string]> = {
  pendente: ['Pendente', 'bg-amber-500/10 text-amber-700'],
  aceito: ['Aceito', 'bg-primary/10 text-primary'],
  expirado: ['Expirado', 'bg-sunk text-muted'],
};

const date = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Só administradores: convidar pessoas por e-mail, reenviar e cancelar convites. */
export default function InvitesAdminPage() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Invite[]>('/invites')
      .then(setInvites)
      .catch(e => setMessage({ ok: false, text: e instanceof ApiError ? e.message : 'Erro ao carregar os convites.' }));
  }, []);
  useEffect(load, [load]);

  // Com o e-mail desligado, o convite vale do mesmo jeito: a pessoa entra no site com o Google daquele e-mail.
  const noEmail = (to: string) => `Convite registrado para ${to}. O envio de e-mails está desligado: avise a pessoa para entrar em ${window.location.origin} com a conta Google desse e-mail.`;

  const run = async (action: () => Promise<unknown>, success: string, to?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const r = (await action()) as { emailSent?: boolean } | undefined;
      setMessage({ ok: true, text: to && r?.emailSent === false ? noEmail(to) : success });
      load();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : 'Algo deu errado.' });
    } finally {
      setBusy(false);
    }
  };

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <>
      <Header title="Convites" sub="Só quem você convidar consegue entrar" />
      <div className="space-y-5 px-4 pb-8">

      <form
        className="flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          if (!valid) return;
          run(() => api('/invites', { method: 'POST', body: { email: email.trim() } }), `Convite enviado para ${email.trim()}.`, email.trim()).then(() =>
            setEmail(''),
          );
        }}
      >
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="E-mail da pessoa"
          className={inputCls}
        />
        <Button type="submit" disabled={!valid || busy}>
          Convidar
        </Button>
      </form>

      {message && (
        <p role="status" className={`rounded-xl px-4 py-2.5 text-sm ${message.ok ? 'bg-primary/10 text-primary' : 'bg-red-500/5 text-red-700'}`}>
          {message.text}
        </p>
      )}

      <section className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-soft">
        {invites?.length === 0 && <p className="p-4 text-sm text-muted">Nenhum convite ainda.</p>}
        {invites?.map(i => (
          <div key={i.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.email}</p>
              <p className="text-xs text-muted">
                {i.status === 'aceito'
                  ? `Aceito por ${i.aceitoPor ?? '—'}`
                  : `Enviado por ${i.convidadoPor} em ${date(i.criadoEm)} · vale até ${date(i.expiraEm)}`}
              </p>
            </div>
            <span className={`rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold ${STATUS[i.status][1]}`}>{STATUS[i.status][0]}</span>
            {i.status !== 'aceito' && (
              <>
                <button
                  disabled={busy}
                  onClick={() => run(() => api(`/invites/${i.id}/resend`, { method: 'POST' }), `Convite reenviado para ${i.email}.`, i.email)}
                  className="text-sm font-semibold text-primary disabled:opacity-40"
                >
                  Reenviar
                </button>
                <button
                  disabled={busy}
                  onClick={() => run(() => api(`/invites/${i.id}`, { method: 'DELETE' }), 'Convite cancelado.')}
                  className="text-sm font-semibold text-red-600 disabled:opacity-40"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        ))}
      </section>
      </div>
    </>
  );
}
