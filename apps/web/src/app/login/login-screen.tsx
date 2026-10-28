'use client';

import { useSearchParams } from 'next/navigation';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Leaves, Logo, Wordmark } from '@/components/art';
import { Icon, type IconName } from '@/components/icon';
import { Seg } from '@/components/primitives';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';

type Providers = { google: boolean; dev: boolean; convite: boolean; senha: boolean };
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

/**
 * Passos da tela: entrar, criar conta (e confirmar o código do e-mail)
 * e "esqueci minha senha" (pedir o código e criar a senha nova).
 */
type Step = 'entrar' | 'criar' | 'confirmar' | 'esqueci' | 'nova-senha';

export function LoginScreen() {
  const params = useSearchParams();
  const erro = params.get('erro');
  const [providers, setProviders] = useState<Providers | null>(null);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [step, setStep] = useState<Step>(params.get('criar') ? 'criar' : 'entrar');
  const [f, setF] = useState({ name: '', email: params.get('email') ?? '', password: '', code: '', terms: false });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; info?: string }>({});
  const [wait, setWait] = useState(0);

  useEffect(() => {
    api<Providers>('/auth/providers').then(p => {
      setProviders(p);
      if (p.dev) api<DevUser[]>('/auth/dev/users').then(setDevUsers);
    });
  }, []);

  // Contagem para "Reenviar código" (a API aceita um novo a cada minuto).
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const go = (s: Step, info?: string) => {
    setStep(s);
    setMsg({ info });
    setF(x => ({ ...x, code: '', password: s === 'nova-senha' ? '' : x.password }));
  };

  /** Chama a API; sucesso que abre a sessão leva para o app. */
  const run = async (key: string, fn: () => Promise<unknown>, next?: () => void) => {
    setBusy(key);
    setMsg({});
    try {
      await fn();
      if (next) next();
      else window.location.href = '/';
    } catch (e) {
      setMsg({ error: e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo em instantes.' });
    } finally {
      setBusy(null);
    }
  };

  const sendCode = (purpose: 'cadastro' | 'senha') =>
    run(
      'code',
      () =>
        purpose === 'cadastro'
          ? api('/auth/signup', { method: 'POST', body: { name: f.name, email: f.email, password: f.password, acceptTerms: f.terms } })
          : api('/auth/password/forgot', { method: 'POST', body: { email: f.email } }),
      () => {
        setWait(60);
        go(purpose === 'cadastro' ? 'confirmar' : 'nova-senha', `Mandamos um código de 6 números para ${f.email}. Confira também a caixa de spam.`);
      },
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'entrar') run('form', () => api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } }));
    if (step === 'criar') sendCode('cadastro');
    if (step === 'esqueci') sendCode('senha');
    if (step === 'confirmar') run('form', () => api('/auth/signup/verify', { method: 'POST', body: { email: f.email, code: f.code } }));
    if (step === 'nova-senha') run('form', () => api('/auth/password/reset', { method: 'POST', body: { email: f.email, code: f.code, password: f.password } }));
  };

  const devLogin = (id: string) => run(id, () => api('/auth/dev/login', { method: 'POST', body: { userId: id } }));

  const senha = providers?.senha ?? false;
  const codeStep = step === 'confirmar' || step === 'nova-senha';
  const TITLES: Record<Step, [string, string]> = {
    entrar: ['Que bom te ver de novo', 'Entre para continuar a sua sprint.'],
    criar: ['Crie a sua conta', providers?.convite ? 'Use o e-mail em que você recebeu o convite.' : 'Leva menos de um minuto.'],
    confirmar: ['Confirme o seu e-mail', 'Digite o código que chegou no seu e-mail.'],
    esqueci: ['Esqueceu a senha?', 'Mandamos um código para você criar uma senha nova.'],
    'nova-senha': ['Crie uma senha nova', 'Digite o código do e-mail e a senha nova.'],
  };
  const BUTTON: Record<Step, string> = {
    entrar: 'Entrar',
    criar: 'Criar conta',
    confirmar: 'Confirmar e entrar',
    esqueci: 'Enviar código',
    'nova-senha': 'Salvar senha e entrar',
  };
  const ready =
    step === 'entrar'
      ? f.email && f.password
      : step === 'criar'
        ? f.name.trim().length > 1 && f.email && f.password.length >= 8 && f.terms
        : step === 'esqueci'
          ? f.email
          : f.code.length === 6 && (step === 'confirmar' || f.password.length >= 8);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-sm flex-col px-4 pb-10">
      {/* Topo: logo sobre um degradê suave com folhas, no lugar da ilustração. */}
      <header className="relative -mx-4 overflow-hidden px-4 pb-6 pt-12 text-center">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent" />
        <Leaves className="absolute -right-10 -top-6 -z-10 h-44 w-44 opacity-70" />
        <Leaves className="absolute -left-14 top-16 -z-10 h-36 w-36 -scale-x-100 opacity-40" />
        <Logo className="mx-auto h-16 w-16" />
        <Wordmark className="mt-2 text-[2rem]" />
        <p className="mt-1 text-sm text-muted">Planeje e execute a sua vida em sprints.</p>
      </header>

      {erro && <Alert>{ERRORS[erro] ?? ERRORS['google-falhou']}</Alert>}

      {senha && (step === 'entrar' || step === 'criar') && (
        <div className="mb-5">
          <Seg
            items={[
              { id: 'entrar', label: 'Entrar' },
              { id: 'criar', label: 'Criar conta' },
            ]}
            value={step}
            onChange={s => go(s)}
          />
        </div>
      )}

      {senha && (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="mb-1">
            {codeStep || step === 'esqueci' ? (
              <button type="button" onClick={() => go('entrar')} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
                <Icon n="chevL" className="h-4 w-4" />
                Voltar
              </button>
            ) : null}
            <h1 className="text-xl font-bold">{TITLES[step][0]}</h1>
            <p className="text-sm text-muted">{TITLES[step][1]}</p>
          </div>

          {msg.info && <p className="rounded-xl bg-primary/10 px-3.5 py-2.5 text-sm text-primary">{msg.info}</p>}
          {msg.error && <Alert>{msg.error}</Alert>}

          {step === 'criar' && (
            <Input icon="user" label="Nome" value={f.name} onChange={name => setF({ ...f, name })} autoComplete="name" placeholder="Como você quer ser chamado" />
          )}
          {!codeStep && (
            <Input icon="mail" label="E-mail" type="email" value={f.email} onChange={email => setF({ ...f, email })} autoComplete="email" placeholder="voce@email.com" />
          )}
          {codeStep && (
            <label className="block">
              <span className="sr-only">Código de 6 números</span>
              <input
                value={f.code}
                onChange={e => setF({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="000000"
                className="w-full rounded-2xl border border-line bg-surface py-4 pl-[0.5em] text-center text-[1.75rem] font-bold tracking-[0.5em] placeholder:text-muted/40 focus:border-primary"
                style={{ outline: 'none' }}
              />
            </label>
          )}
          {step !== 'esqueci' && step !== 'confirmar' && (
            <Input
              icon="lock"
              label={step === 'nova-senha' ? 'Senha nova' : 'Senha'}
              type={show ? 'text' : 'password'}
              value={f.password}
              onChange={password => setF({ ...f, password })}
              autoComplete={step === 'entrar' ? 'current-password' : 'new-password'}
              placeholder={step === 'entrar' ? 'Sua senha' : 'Pelo menos 8 caracteres'}
              end={
                <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'} className="p-1 text-muted hover:text-ink">
                  <Icon n={show ? 'eyeOff' : 'eye'} className="h-5 w-5" />
                </button>
              }
            />
          )}

          {step === 'entrar' && (
            <div className="text-right">
              <button type="button" onClick={() => go('esqueci')} className="text-sm font-medium text-primary">
                Esqueci minha senha
              </button>
            </div>
          )}
          {step === 'criar' && (
            <label className="flex items-start gap-2.5 py-1 text-sm text-ink/80">
              <input type="checkbox" checked={f.terms} onChange={e => setF({ ...f, terms: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[rgb(var(--p))]" />
              <span>
                Li e aceito os{' '}
                <a href="/termos" target="_blank" className="font-semibold text-primary underline-offset-2 hover:underline">
                  termos de uso e a política de privacidade
                </a>
                .
              </span>
            </label>
          )}

          <Button type="submit" className="w-full py-3 text-[0.9375rem]" disabled={!ready || busy !== null}>
            {busy === 'form' || busy === 'code' ? 'Aguarde…' : BUTTON[step]}
          </Button>

          {codeStep && (
            <p className="text-center text-sm text-muted">
              Não chegou?{' '}
              <button
                type="button"
                disabled={wait > 0 || busy !== null}
                onClick={() => sendCode(step === 'confirmar' ? 'cadastro' : 'senha')}
                className="font-semibold text-primary disabled:text-muted"
              >
                {wait > 0 ? `Reenviar em ${wait}s` : 'Reenviar código'}
              </button>
            </p>
          )}
        </form>
      )}

      {!codeStep && step !== 'esqueci' && (
        <div className="mt-5 space-y-3">
          {senha && (
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              ou
              <span className="h-px flex-1 bg-line" />
            </div>
          )}
          <a
            href={providers?.google ? '/api/auth/google' : undefined}
            aria-disabled={!providers?.google}
            className={`flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 font-semibold shadow-soft ${
              providers?.google ? 'hover:bg-sunk' : 'pointer-events-none opacity-50'
            }`}
          >
            <GoogleIcon />
            {step === 'criar' ? 'Criar conta com Google' : 'Entrar com Google'}
          </a>
          {providers && !providers.google && <p className="text-center text-xs text-muted">Login com Google ainda não configurado neste ambiente.</p>}
          {providers?.convite && <p className="text-center text-xs text-muted">Acesso só por convite, nesta fase de testes.</p>}
        </div>
      )}

      {providers?.dev && step === 'entrar' && (
        <section className="mt-8 rounded-2xl border border-dashed border-line p-4">
          <h2 className="text-sm font-semibold">Login de desenvolvimento</h2>
          <p className="mb-3 text-xs text-muted">Só aparece no ambiente local. Entre com um clique (ou com a senha teste1234):</p>
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
                  {u.role === 'admin' && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-primary">Admin</span>}
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

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-400">
      {children}
    </p>
  );
}

/** Campo com ícone à esquerda (e um botão opcional à direita, como o "mostrar senha"). */
function Input({
  icon,
  label,
  value,
  onChange,
  end,
  ...p
}: {
  icon: IconName;
  label: string;
  value: string;
  onChange: (v: string) => void;
  end?: ReactNode;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 focus-within:border-primary">
      <Icon n={icon} className="h-5 w-5 shrink-0 text-muted" />
      <span className="sr-only">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base placeholder:text-muted/70 focus:outline-none sm:text-[0.9375rem]"
        // O contorno de foco fica na borda do campo inteiro (focus-within), não no texto.
        style={{ outline: 'none' }}
        {...p}
      />
      {end}
    </label>
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
