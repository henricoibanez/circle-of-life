'use client';

import { PALETTES, type PaletteId } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Art, Leaves } from '@/components/art';
import { Bell } from '@/components/bell';
import { ConfirmSheet } from '@/components/confirm';
import { useGoBack } from '@/components/header';
import { Icon, type IconName } from '@/components/icon';
import { Avatar, Bar, Card, Field, IconBtn, inputCls, Ring, Seg, ImageHint } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError, logout, type Me } from '@/lib/api';
import { tint } from '@/lib/color';
import { xpVisible } from '@/lib/journey';
import { useMe } from '@/lib/me';
import { since } from '@/lib/time';
import { disablePush, enablePush, pushActive, pushSupported } from '@/lib/notifications';
import { uploadImage } from '@/lib/upload';
import { HealthStatus } from '../health-status';

type Usage = { maslow: number; roda: number; necrologio: number; quadro: number; backlog: number };
type Activity = { id: string; icon: IconName; text: string; link: string; createdAt: string };

const TOOLS: { key: keyof Usage; href: string; n: IconName; l: string; c: string }[] = [
  { key: 'maslow', href: '/maslow', n: 'triangle', l: 'Pirâmide de Maslow', c: '#16a34a' },
  { key: 'roda', href: '/roda', n: 'circle', l: 'Roda da Vida', c: '#3b82f6' },
  { key: 'necrologio', href: '/necrologio', n: 'feather', l: 'Necrológio', c: '#7c4dde' },
  { key: 'quadro', href: '/quadro', n: 'eye', l: 'Quadro de Visualização', c: '#f59e0b' },
  { key: 'backlog', href: '/backlog', n: 'board', l: 'Backlog Estruturado', c: '#ef4444' },
];

const VISIBILITY = [
  { id: 'publico' as const, label: 'Todo mundo' },
  { id: 'amigos' as const, label: 'Somente amigos' },
  { id: 'privado' as const, label: 'Privado' },
];

/** Meu Perfil e configurações (como no protótipo, só com XP: sem nível, streak e conquistas). */
export default function PerfilPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const goBack = useGoBack('/mais');
  const { openSheet } = useSheets();
  const { data: me } = useMe();
  const { data: usage } = useQuery({ queryKey: ['usage'], queryFn: () => api<Usage>('/me/usage') });
  const { data: activity } = useQuery({ queryKey: ['activity'], queryFn: () => api<Activity[]>('/me/activity') });

  // Volta da conexão com a Google Agenda (?agenda=ok|erro).
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('agenda');
    if (!r) return;
    history.replaceState(null, '', '/perfil');
    if (r === 'ok') {
      toast('Google Agenda conectada');
      api<Me>('/me').then(m => qc.setQueryData(['me'], m));
    } else toast('Não foi possível conectar a Google Agenda. Tente de novo.');
  }, [qc, toast]);

  if (!me) return null;

  const prefs = me.preferences;
  const setPrefs = async (p: Partial<Me['preferences']>) => {
    qc.setQueryData<Me>(['me'], m => m && { ...m, preferences: { ...m.preferences, ...p } });
    try {
      qc.setQueryData(['me'], await api<Me>('/me/preferences', { method: 'PATCH', body: p }));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
      qc.invalidateQueries({ queryKey: ['me'] });
    }
  };
  const overall = usage ? TOOLS.reduce((s, t) => s + usage[t.key], 0) / TOOLS.length : 0;

  return (
    <>
      <header className="sticky z-20 flex items-start gap-2 bg-bg/90 px-4 pb-2 pt-4 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <IconBtn n="arrowL" label="Voltar" className="-ml-2" onClick={goBack} />
        <div className="flex-1">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight">Meu Perfil</h1>
          <p className="text-sm text-muted">Sua jornada, seu progresso, sua vida.</p>
        </div>
        <Bell />
        <IconBtn n="settings" label="Configurações" onClick={() => document.getElementById('temas')?.scrollIntoView({ behavior: 'smooth' })} />
      </header>

      <div className="space-y-4 px-4 pb-8">
        <div className="relative overflow-hidden rounded-3xl border border-line/80 bg-gradient-to-br from-primary/5 to-surface shadow-soft">
          <Leaves className="pointer-events-none absolute -right-8 -top-4 h-60 w-60" />
          <div className="relative flex gap-4 p-5">
            <div className="relative shrink-0">
              <Avatar name={me.name} photo={me.photoUrl} size="w-24 h-24 text-3xl" ring />
              <button
                onClick={() => openSheet(close => <ProfileForm onClose={close} />)}
                aria-label="Trocar foto"
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-line bg-surface shadow-soft"
              >
                <Icon n="camera" className="h-4 w-4 text-primary" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[1.375rem] font-semibold leading-tight">
                {me.name}
                <span className="text-primary">
                  <Icon n="verified" className="h-5 w-5" />
                </span>
              </p>
              {me.googleConnected && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[0.75rem] font-medium">
                  <Icon n="google" className="h-3.5 w-3.5" />
                  Conectado com Google
                  <span className="text-primary">
                    <Icon n="checkCircle" className="h-3.5 w-3.5" />
                  </span>
                </span>
              )}
              <p className="mt-2 truncate text-[0.8125rem] text-muted">{me.email}</p>
              <p className="text-[0.8125rem] text-muted">ID: @{me.handle}</p>
            </div>
          </div>
          {me.bio && (
            <p className="relative flex items-start gap-2 px-5 text-sm">
              <Icon n="leaf" className="mt-0.5 h-4 w-4 text-primary" />
              {me.bio}
            </p>
          )}
          <div className="relative p-5 pt-3">
            <Button variant="pline" className="rounded-full bg-surface/80 px-4 py-2" onClick={() => openSheet(close => <ProfileForm onClose={close} />)}>
              <Icon n="edit" className="h-4 w-4" />
              Editar perfil
            </Button>
          </div>
        </div>

        {xpVisible(me) && (
        <Card className="grid grid-cols-2 divide-x divide-line py-3 text-center">
          {[
            ['XP total', me.xp.total, 'star', 'text-amber-500'],
            ['XP disponível', me.xp.disponivel, 'gem', 'text-accent'],
          ].map(([l, n, ic, c]) => (
            <div key={l as string}>
              <p className="text-[0.8125rem] text-muted">{l}</p>
              <p className="mt-0.5 text-[1.375rem] font-semibold">{(n as number).toLocaleString('pt-BR')}</p>
              <span className={`mt-0.5 inline-block ${c}`}>
                <Icon n={ic as IconName} className="h-5 w-5" fill="currentColor" sw={1} />
              </span>
            </div>
          ))}
        </Card>
        )}

        <Card className="p-4">
          <div className="flex items-center">
            <h2 className="flex-1 font-semibold">Seu progresso geral</h2>
            <p className="font-semibold text-primary">
              <span className="text-xl">{Math.round(overall * 100)}%</span> <span className="text-sm font-normal text-muted">utilizado</span>
            </p>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex shrink-0 flex-col items-center">
              <Ring pct={overall} size={122} stroke={10}>
                <span className="text-[1.875rem] font-semibold">{Math.round(overall * 100)}%</span>
              </Ring>
              <p className="mt-2 text-sm">Faltam {100 - Math.round(overall * 100)}%</p>
              <p className="text-[0.6875rem] text-muted">para 100% de utilização</p>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {TOOLS.map(t => (
                <Link key={t.key} href={t.href} className="flex w-full items-center gap-2.5 text-left">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line" style={{ color: t.c }}>
                    <Icon n={t.n} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex text-[0.7813rem]">
                      <span className="flex-1 truncate">{t.l}</span>
                      <span className="tabular-nums">{Math.round((usage?.[t.key] ?? 0) * 100)}%</span>
                    </span>
                    <Bar pct={usage?.[t.key] ?? 0} color={t.c} className="mt-1.5 h-1" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <Link href="/relatorios" className="mt-4 flex w-full items-center gap-2 rounded-xl bg-sunk/70 px-4 py-3 text-sm font-medium">
            <Icon n="chart" className="h-5 w-5 text-primary" />
            <span className="flex-1 text-center">Ver relatório completo</span>
            <Icon n="chevR" className="h-4 w-4" />
          </Link>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Suas ferramentas</h2>
          <div className="grid grid-cols-5 gap-2">
            {TOOLS.map(t => (
              <Link key={t.key} href={t.href} className="flex flex-col items-center gap-2 rounded-2xl bg-sunk/60 px-1 py-3 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: tint(t.c, 0.12), color: t.c }}>
                  <Icon n={t.n} />
                </span>
                <span className="text-[0.6875rem] leading-tight">{t.l}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Atividade recente</h2>
          <div className="divide-y divide-line rounded-xl border border-line">
            {(activity ?? []).slice(0, 5).map(r => (
              <Link key={r.id} href={r.link} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                <span className="text-primary">
                  <Icon n={r.icon} />
                </span>
                <span className="flex-1 text-[0.8125rem] text-ink/85">{r.text}</span>
                <span className="text-xs text-muted">{since(r.createdAt)}</span>
                <Icon n="chevR" className="h-4 w-4 text-muted" />
              </Link>
            ))}
            {activity?.length === 0 && <p className="p-3 text-sm text-muted">Nada por aqui ainda.</p>}
          </div>
        </Card>

        <Card className="p-4" id="temas">
          <h2 className="font-semibold">Preferências de tema</h2>
          <p className="text-xs text-muted">Escolha seu tema favorito</p>
          <div className="no-bar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {PALETTES.map(p => {
              const on = !prefs.randomTheme && prefs.palette === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPrefs({ palette: p.id as PaletteId, randomTheme: false })}
                  aria-pressed={on}
                  className="flex w-[3.875rem] shrink-0 flex-col items-center gap-1.5"
                >
                  <span className={`relative h-14 w-14 overflow-hidden rounded-full ${on ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''}`}>
                    <Art v={p.art} c={p.c} className="h-full w-full" />
                    {on && (
                      <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-primary text-onprimary ring-2 ring-surface">
                        <Icon n="check" className="h-3 w-3" sw={3} />
                      </span>
                    )}
                  </span>
                  <span className="text-center text-[0.6875rem] leading-tight">
                    {p.name}
                    <br />
                    {p.sub}
                  </span>
                </button>
              );
            })}
            <button onClick={() => setPrefs({ randomTheme: true })} aria-pressed={prefs.randomTheme} className="flex w-[3.875rem] shrink-0 flex-col items-center gap-1.5">
              <span
                className={`grid h-14 w-14 place-items-center rounded-full ${prefs.randomTheme ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: 'conic-gradient(#5e873c,#346ab8,#7c4dde,#c85858,#ba8418,#5e873c)' }}
              >
                <span className="h-11 w-11 rounded-full bg-surface" />
              </span>
              <span className="text-center text-[0.6875rem] leading-tight">
                Aleatório
                <br />
                <span className="text-[0.5625rem] text-muted">muda a cada 2 min</span>
              </span>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-sunk/60 p-3.5">
            <Icon n="sparkles" className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Modo aleatório {prefs.randomTheme ? 'ativado' : 'desativado'}</p>
              <p className="text-xs text-muted">As cores mudam sozinhas a cada 2 minutos. O claro ou escuro continua como você escolheu.</p>
            </div>
            <button
              role="switch"
              aria-checked={prefs.randomTheme}
              aria-label="Modo aleatório"
              onClick={() => setPrefs({ randomTheme: !prefs.randomTheme })}
              className={`h-7 w-12 rounded-full p-0.5 transition ${prefs.randomTheme ? 'bg-primary' : 'bg-line'}`}
            >
              <span className={`block h-6 w-6 rounded-full bg-white shadow transition ${prefs.randomTheme ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="mb-2 mt-4 text-sm font-semibold">Aparência</p>
          <Seg
            items={[
              { id: 'auto' as const, label: 'Automática' },
              { id: 'light' as const, label: 'Clara' },
              { id: 'dark' as const, label: 'Escura' },
            ]}
            value={prefs.themeMode}
            onChange={themeMode => setPrefs({ themeMode })}
          />
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold">Privacidade</h2>
          <p className="mb-3 text-xs text-muted">Quem vê os seus posts e stories, por padrão. Dá para mudar em cada post.</p>
          <Seg items={VISIBILITY} value={prefs.defaultPostVisibility} onChange={defaultPostVisibility => setPrefs({ defaultPostVisibility })} />
        </Card>

        {me.googleCalendar.available && (
          <Card className="p-4">
            <h2 className="font-semibold">Google Agenda</h2>
            <p className="mb-3 text-xs text-muted">
              Conecte para, ao pôr uma data numa tarefa, criar o evento na sua agenda (com o título e a descrição).
            </p>
            {me.googleCalendar.connected ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  <Icon n="verified" className="h-4 w-4" />
                  Conectada
                </span>
                <Button
                  variant="line"
                  className="ml-auto"
                  onClick={async () => {
                    await api('/calendar', { method: 'DELETE' });
                    qc.setQueryData(['me'], await api<Me>('/me'));
                    toast('Google Agenda desconectada');
                  }}
                >
                  Desconectar
                </Button>
              </div>
            ) : (
              <a href="/api/calendar/google" className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold shadow-soft hover:bg-sunk">
                <Icon n="calendar" className="h-4 w-4" />
                Conectar Google Agenda
              </a>
            )}
          </Card>
        )}

        <PushCard />

        <Card className="space-y-2 p-4">
          <h2 className="font-semibold">Estado do sistema</h2>
          <HealthStatus />
        </Card>

        <Card className="p-4">
          <Button variant="line" className="w-full" onClick={logout}>
            <Icon n="arrowL" className="h-4 w-4" />
            Sair da conta
          </Button>
          <Button
            variant="danger"
            className="mt-2 w-full"
            onClick={() => openSheet(close => <DeleteAccountSheet onClose={close} />)}
          >
            Excluir minha conta
          </Button>
        </Card>
      </div>
    </>
  );
}

/** Excluir minha conta: só depois de digitar DELETAR (decisão do dono de 04/11/2026). */
function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = word.trim().toUpperCase() === 'DELETAR';
  const remove = async () => {
    setBusy(true);
    try {
      await api('/me', { method: 'DELETE', body: { confirm: word } });
      window.location.href = '/login';
    } catch (e) {
      setBusy(false);
      toast(e instanceof ApiError ? e.message : 'Não foi possível excluir a conta.');
    }
  };
  return (
    <Sheet
      title="Excluir minha conta"
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1 !bg-red-600 !text-white" disabled={!ok || busy} onClick={remove}>
            Excluir para sempre
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[0.9375rem] leading-relaxed text-ink/85">
        <p>Todos os seus dados serão apagados: backlog, sprints, exercícios, sonhos, fotos e XP.</p>
        <p className="font-semibold">Não dá para desfazer.</p>
        <label className="block">
          <span className="mb-1.5 block text-sm">
            Para confirmar, digite <strong>DELETAR</strong>:
          </span>
          <input value={word} onChange={e => setWord(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="DELETAR" className={inputCls} />
        </label>
      </div>
    </Sheet>
  );
}

/** Editar perfil: foto, nome, ID e bio. O e-mail é o da conta Google e não muda aqui. */
function ProfileForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: me } = useMe();
  const [f, setF] = useState({ name: me?.name ?? '', handle: me?.handle ?? '', bio: me?.bio ?? '' });
  const [photo, setPhoto] = useState<{ id?: string | null; url: string | null }>({ url: me?.photoUrl ?? null });
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: f.name.trim(), handle: f.handle.replace(/^@/, '').trim(), bio: f.bio, ...(photo.id !== undefined ? { photoFileId: photo.id } : {}) };
      qc.setQueryData(['me'], await api<Me>('/me', { method: 'PATCH', body }));
      toast('Perfil salvo');
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Editar perfil"
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={!f.name.trim() || busy} onClick={save}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-4">
          <Avatar name={f.name || '?'} photo={photo.url} size="w-20 h-20 text-2xl" />
          <span className="text-sm font-semibold text-primary">{busy ? 'Enviando…' : 'Trocar foto'}</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={async e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              try {
                const up = await uploadImage(file, 'avatar', 400);
                setPhoto({ id: up.id, url: up.url });
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Não foi possível enviar a foto.');
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <ImageHint purpose="avatar" />
        {photo.url && (
          <button className="text-sm text-muted" onClick={() => setPhoto({ id: null, url: null })}>
            Remover foto
          </button>
        )}
        <Field label="Nome">
          <input className={inputCls} value={f.name} maxLength={80} onChange={e => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <input className={`${inputCls} text-muted`} value={me.email} disabled />
        </Field>
        <Field label="ID">
          <input className={inputCls} value={f.handle} maxLength={31} onChange={e => setF({ ...f, handle: e.target.value.toLowerCase() })} />
        </Field>
        <Field label="Bio">
          <textarea rows={2} maxLength={300} className={inputCls} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Ligar ou desligar as notificações neste aparelho (Web Push). */
function PushCard() {
  const toast = useToast();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    pushActive().then(setOn);
  }, []);
  if (!pushSupported()) return null;
  const toggle = async () => {
    setBusy(true);
    try {
      if (on) await disablePush();
      else await enablePush();
      setOn(!on);
      toast(on ? 'Notificações desligadas neste aparelho' : 'Notificações ligadas neste aparelho');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível mudar as notificações.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="flex items-center gap-3 p-4">
      <Icon n="bell" className="h-6 w-6 text-primary" />
      <div className="flex-1">
        <p className="text-sm font-semibold">Notificações no celular</p>
        <p className="text-xs text-muted">Avisos de tarefas atrasadas, curtidas e comentários, mesmo com o app fechado. No iPhone, adicione o app à tela inicial antes.</p>
      </div>
      <button
        role="switch"
        aria-checked={Boolean(on)}
        aria-label="Notificações no celular"
        disabled={busy || on === null}
        onClick={toggle}
        className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition disabled:opacity-50 ${on ? 'bg-primary' : 'bg-line'}`}
      >
        <span className={`block h-6 w-6 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : ''}`} />
      </button>
    </Card>
  );
}
