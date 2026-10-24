'use client';

import { AREA, type GroupDto, type PersonDto } from '@circle/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ConfirmSheet } from '@/components/confirm';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { Avatar, Card, IconBtn, inputCls, Seg } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { GroupCover, GroupForm } from '@/components/social/group-sheets';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { mix } from '@/lib/color';
import { useFriends, useGroups, useSocialActions } from '@/lib/social';

type Tab = 'grupos' | 'amigos';

export default function GruposPage() {
  return (
    <Suspense>
      <Grupos />
    </Suspense>
  );
}

/** Amigos e grupos (como no protótipo, sem discussões, desafios, eventos nem "online"). */
function Grupos() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get('aba') === 'amigos' ? 'amigos' : 'grupos';
  const setTab = (t: Tab) => router.replace(`/grupos?aba=${t}`);
  return (
    <>
      <Header title="Amigos e grupos" sub="Conecte-se, compartilhe e evolua junto" right={<IconBtn n="userPlus" label="Adicionar amigo" box onClick={() => setTab('amigos')} />} />
      <div className="space-y-4 px-4 pb-8">
        <Seg
          tone="a"
          items={[
            { id: 'grupos', label: 'Grupos', icon: 'users' },
            { id: 'amigos', label: 'Amigos', icon: 'user' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'grupos' ? <GruposTab /> : <AmigosTab />}
      </div>
    </>
  );
}

function GruposTab() {
  const { data } = useGroups();
  const actions = useSocialActions();
  const toast = useToast();
  const router = useRouter();
  const { openSheet } = useSheets();
  const [q, setQ] = useState('');
  const match = (g: GroupDto) => g.name.toLowerCase().includes(q.toLowerCase());
  const mine = (data?.mine ?? []).filter(match);
  const sug = (data?.suggested ?? []).filter(match);

  return (
    <>
      <div className="relative">
        <Icon n="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar grupos…" className={inputCls + ' pl-10'} />
      </div>
      <h2 className="text-[17px] font-semibold">Meus grupos</h2>
      {mine.map(g => (
        <div key={g.id} className="overflow-hidden rounded-3xl border border-line/80 bg-surface shadow-soft">
          <Link
            href={`/grupos/${g.id}`}
            className="relative flex items-center gap-4 p-4 text-white"
            style={{ background: `linear-gradient(120deg, ${mix(AREA[g.area].color, '#000', 0.78)}, ${mix(AREA[g.area].color, '#000', 0.55)})` }}
          >
            <GroupCover g={g} className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-white/80" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[19px] font-semibold">
                {g.name}
                {g.admin && <span className="rounded-md border border-white/20 bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">Administrador</span>}
              </p>
              <p className="mt-1 text-[13px] text-white/80">{g.description}</p>
            </div>
            <p className="shrink-0 self-start text-right text-[12px] text-white/85">{g.members === 1 ? '1 membro' : `${g.members} membros`}</p>
          </Link>
          <div className="flex items-center gap-2 px-4 py-3 text-[12px]">
            <span className="flex-1">
              <span className="block font-medium">Trilhas</span>
              <span className="text-muted">{g.trilhas === 1 ? '1 trilha' : `${g.trilhas} trilhas`}</span>
            </span>
            <span className="flex-1">
              <span className="block font-medium">Área</span>
              <span className="text-muted">{AREA[g.area].name}</span>
            </span>
            <Button variant="aline" className="rounded-full px-3 py-1.5" onClick={() => router.push(`/grupos/${g.id}`)}>
              Abrir grupo
            </Button>
          </div>
        </div>
      ))}
      {data && !mine.length && <p className="text-sm text-muted">Você ainda não participa de grupos.</p>}

      <h2 className="text-[17px] font-semibold">Grupos sugeridos</h2>
      <div className="no-bar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {sug.map(g => (
          <div key={g.id} className="w-40 shrink-0 overflow-hidden rounded-2xl border border-line/80 bg-surface shadow-soft">
            <div className="relative">
              <Link href={`/grupos/${g.id}`} aria-label={`Ver ${g.name}`}>
                <GroupCover g={g} className="h-24 w-full" />
              </Link>
              <button
                aria-label={`Entrar em ${g.name}`}
                onClick={async () => {
                  try {
                    await actions.join(g.id);
                    toast(`Você entrou em ${g.name}`);
                  } catch (e) {
                    toast(e instanceof ApiError ? e.message : 'Não foi possível entrar.');
                  }
                }}
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-accent"
              >
                <Icon n="userPlus" className="h-4 w-4" />
              </button>
            </div>
            <Link href={`/grupos/${g.id}`} className="block p-3">
              <p className="text-[14px] font-semibold leading-tight">{g.name}</p>
              <p className="text-[11px] text-muted">{g.members === 1 ? '1 membro' : `${g.members} membros`}</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink/75">{g.description}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-[11px]" style={{ color: AREA[g.area].color }}>
                <Icon n={AREA[g.area].icon} className="h-3.5 w-3.5" />
                {AREA[g.area].name}
              </p>
            </Link>
          </div>
        ))}
        {data && !sug.length && <p className="text-sm text-muted">Você já está em todos os grupos.</p>}
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-accent/5 p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-white">
          <Icon n="users" />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-accent">Crie seu próprio grupo</p>
          <p className="text-xs text-muted">Reúna pessoas com os mesmos interesses e evoluam juntos.</p>
        </div>
        <Button variant="accent" className="rounded-full" onClick={() => openSheet(close => <GroupForm onClose={close} onSaved={g => router.push(`/grupos/${g.id}`)} />)}>
          Criar grupo
        </Button>
      </div>
    </>
  );
}

function PersonRow({ p, children }: { p: PersonDto; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3.5">
      <Avatar name={p.name} photo={p.photoUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{p.name}</p>
        <p className="truncate text-xs text-muted">@{p.handle}</p>
      </div>
      {children}
    </div>
  );
}

function AmigosTab() {
  const { data } = useFriends();
  const actions = useSocialActions();
  const toast = useToast();
  const { openSheet } = useSheets();
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      const r = await actions.request(who.trim());
      toast(r.status === 'amigos' ? 'Vocês agora são amigos' : 'Pedido enviado');
      setWho('');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível enviar o pedido.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Adicionar amigo</h2>
        <form
          className="flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            if (who.trim().length >= 2) send();
          }}
        >
          <input value={who} onChange={e => setWho(e.target.value)} placeholder="E-mail ou @ID do amigo" className={inputCls} autoCapitalize="none" />
          <Button variant="accent" type="submit" disabled={busy || who.trim().length < 2}>
            Enviar
          </Button>
        </form>
      </Card>
      {!!data?.received.length && (
        <section>
          <h2 className="mb-2 font-semibold">Solicitações recebidas</h2>
          <Card className="divide-y divide-line">
            {data.received.map(r => (
              <PersonRow key={r.id} p={r.person}>
                <Button variant="ghost" className="px-3 py-1.5" onClick={() => run(() => actions.dismiss(r.id))}>
                  Recusar
                </Button>
                <Button variant="asoft" className="px-3 py-1.5" onClick={() => run(() => actions.accept(r.id), `Você e ${r.person.name.split(' ')[0]} agora são amigos`)}>
                  Aceitar
                </Button>
              </PersonRow>
            ))}
          </Card>
        </section>
      )}
      {!!data?.sent.length && (
        <section>
          <h2 className="mb-2 font-semibold">Solicitações enviadas</h2>
          <Card className="divide-y divide-line">
            {data.sent.map(r => (
              <PersonRow key={r.id} p={r.person}>
                <Button variant="ghost" className="px-3 py-1.5" onClick={() => run(() => actions.dismiss(r.id), 'Pedido cancelado')}>
                  Cancelar
                </Button>
              </PersonRow>
            ))}
          </Card>
        </section>
      )}
      <section>
        <h2 className="mb-2 font-semibold">Meus amigos</h2>
        <Card className="divide-y divide-line">
          {data?.friends.map(p => (
            <PersonRow key={p.id} p={p}>
              <Button
                variant="danger"
                className="px-3 py-1.5"
                onClick={() =>
                  openSheet(close => (
                    <ConfirmSheet title={`Remover ${p.name}?`} confirm="Remover" danger onConfirm={() => run(() => actions.unfriend(p.id), 'Amigo removido')} onClose={close}>
                      Vocês deixam de ver os posts “Somente amigos” um do outro. Dá para adicionar de novo depois.
                    </ConfirmSheet>
                  ))
                }
              >
                Remover
              </Button>
            </PersonRow>
          ))}
          {data && !data.friends.length && <p className="p-4 text-sm text-muted">Você ainda não adicionou amigos.</p>}
        </Card>
      </section>
    </>
  );
}
