'use client';

import { AREA, type TrilhaDto } from '@circle/shared';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ConfirmSheet } from '@/components/confirm';
import { PostCard } from '@/components/feed/post-card';
import { usePostForm } from '@/components/feed/post-form';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { Avatar, Card, Empty, IconBtn, inputCls, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { ForumSection, TopicSheet } from '@/components/social/forum';
import { AddTrilhaSheet, GroupCover, GroupForm } from '@/components/social/group-sheets';
import { useToast } from '@/components/toasts';
import { Cover, PublishSheet, statusTag, TrilhaSheet } from '@/components/trilhas/trilha-sheets';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { mix } from '@/lib/color';
import { useFeed } from '@/lib/feed';
import { useMe } from '@/lib/me';
import { useGroup, useSocialActions } from '@/lib/social';

/** Página de um grupo: trilhas do grupo (e sugestões), fórum, posts e membros com os gestores. */
export default function GrupoPage() {
  return (
    <Suspense>
      <Grupo />
    </Suspense>
  );
}

function Grupo() {
  const { id } = useParams<{ id: string }>();
  const topico = useSearchParams().get('topico');
  const openedTopic = useRef(false);
  const [memberQuery, setMemberQuery] = useState('');
  const router = useRouter();
  const { data: g, error } = useGroup(id);
  const { data: me } = useMe();
  const actions = useSocialActions();
  const toast = useToast();
  const { openSheet, openActions } = useSheets();
  const newPost = usePostForm();
  const posts = useFeed({ group: id });

  // Aviso do sino ("?topico=..."): abre o tópico assim que a página do grupo carregar.
  useEffect(() => {
    if (!topico || !g?.member || openedTopic.current) return;
    openedTopic.current = true;
    openSheet(close => <TopicSheet groupId={id} topicId={topico} onClose={close} />);
  }, [topico, g?.member, id, openSheet]);

  if (error) {
    return (
      <>
        <Header title="Grupo" fallback="/grupos" />
        <div className="px-4">
          <Empty action={<Button onClick={() => router.push('/grupos')}>Ver grupos</Button>}>Esse grupo não existe mais.</Empty>
        </div>
      </>
    );
  }
  if (!g) return <Header title="Grupo" fallback="/grupos" />;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');
    }
  };
  const color = AREA[g.area].color;
  const openTrilha = (tid: string) => openSheet(close => <TrilhaSheet id={tid} onClose={close} />);

  const menu = () =>
    openActions(g.name, [
      g.admin && { icon: 'edit', label: 'Editar grupo', run: () => openSheet(close => <GroupForm group={g} onClose={close} />) },
      g.admin && { icon: 'plus', label: 'Nova trilha do grupo', run: () => openSheet(close => <PublishSheet groupId={g.id} onClose={close} />) },
      g.admin && { icon: 'bag', label: 'Trazer trilha da loja', run: () => openSheet(close => <AddTrilhaSheet group={g} onClose={close} />) },
      g.member && {
        icon: 'x',
        label: 'Sair do grupo',
        run: () =>
          openSheet(close => (
            <ConfirmSheet title={`Sair de ${g.name}?`} confirm="Sair" onConfirm={() => run(() => actions.leave(g.id), `Você saiu de ${g.name}`)} onClose={close}>
              {g.admin && g.memberList.filter(m => m.role === 'admin').length === 1 && g.members > 1
                ? 'Você é o único gestor. O membro mais antigo passa a ser gestor do grupo.'
                : 'Você pode entrar de novo quando quiser.'}
            </ConfirmSheet>
          )),
      },
      g.admin && {
        icon: 'trash',
        label: 'Excluir grupo',
        danger: true,
        run: () =>
          openSheet(close => (
            <ConfirmSheet
              title={`Excluir ${g.name}?`}
              confirm="Excluir"
              danger
              onConfirm={async () => {
                await run(() => actions.remove(g.id), 'Grupo excluído');
                router.replace('/grupos');
              }}
              onClose={close}
            >
              O grupo e as trilhas dele somem para todos os membros. Quem já importou continua com os épicos no backlog.
            </ConfirmSheet>
          )),
      },
    ]);

  return (
    <>
      <Header title={g.name} fallback="/grupos" right={g.member ? <IconBtn n="more" label="Opções do grupo" box onClick={menu} /> : undefined} />
      <div className="space-y-4 px-4 pb-8">
        <div className="overflow-hidden rounded-3xl text-white shadow-soft" style={{ background: `linear-gradient(120deg, ${mix(color, '#000', 0.78)}, ${mix(color, '#000', 0.55)})` }}>
          <GroupCover g={g} className="h-36 w-full" />
          <div className="p-4">
            <p className="flex flex-wrap items-center gap-2 text-[1.3125rem] font-semibold">
              {g.name}
              {g.admin && <span className="rounded-md border border-white/20 bg-white/15 px-1.5 py-0.5 text-[0.625rem] font-semibold">Gestor</span>}
            </p>
            {g.description && <p className="mt-1 text-[0.875rem] text-white/85">{g.description}</p>}
            <p className="mt-3 flex items-center gap-3 text-[0.75rem] text-white/85">
              <span className="inline-flex items-center gap-1">
                <Icon n="users" className="h-4 w-4" />
                {g.members === 1 ? '1 membro' : `${g.members} membros`}
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon n={AREA[g.area].icon} className="h-4 w-4" />
                {AREA[g.area].name}
              </span>
            </p>
            {!g.member && (
              <Button variant="accent" className="mt-4 w-full" onClick={() => run(() => actions.join(g.id), `Você entrou em ${g.name}`)}>
                <Icon n="userPlus" className="h-4 w-4" />
                Entrar no grupo
              </Button>
            )}
          </div>
        </div>

        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-[1.0625rem] font-semibold">Trilhas do grupo</h2>
            {g.admin && (
              <Button variant="line" className="rounded-full px-3 py-1.5 text-[0.75rem]" onClick={() => openSheet(close => <AddTrilhaSheet group={g} onClose={close} />)}>
                <Icon n="bag" className="h-4 w-4" />
                Da loja
              </Button>
            )}
            {g.member && (
              <Button variant="aline" className="rounded-full px-3 py-1.5 text-[0.75rem]" onClick={() => openSheet(close => <PublishSheet groupId={g.id} onClose={close} />)}>
                <Icon n="plus" className="h-4 w-4" />
                {g.admin ? 'Nova trilha' : 'Sugerir trilha'}
              </Button>
            )}
          </div>
          {g.trilhaList.length ? (
            <TrilhaList list={g.trilhaList} open={openTrilha} />
          ) : (
            <p className="text-sm text-muted">
              {!g.member
                ? 'Entre no grupo para ver as trilhas.'
                : g.admin
                  ? 'Crie uma trilha a partir de um épico seu ou traga uma da loja. Só os membros veem.'
                  : 'O grupo ainda não tem trilhas. Você pode sugerir uma a partir de um épico seu.'}
            </p>
          )}
          {g.suggestions.length > 0 && (
            <div className="mt-3 space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                <Icon n="alert" className="h-4 w-4" />
                {g.admin
                  ? g.suggestions.length === 1
                    ? '1 sugestão aguardando um gestor'
                    : `${g.suggestions.length} sugestões aguardando um gestor`
                  : 'Suas sugestões'}
              </p>
              <TrilhaList list={g.suggestions} open={openTrilha} />
            </div>
          )}
        </section>

        {g.member && <ForumSection groupId={g.id} />}

        {g.member && (
          <section className="space-y-3">
            <div className="flex items-center">
              <h2 className="flex-1 text-[1.0625rem] font-semibold">Posts do grupo</h2>
              <Button variant="aline" className="rounded-full px-3 py-1.5 text-[0.75rem]" onClick={() => newPost(undefined, g.id)}>
                <Icon n="plus" className="h-4 w-4" />
                Criar post
              </Button>
            </div>
            {posts.data?.pages.flatMap(p => p.posts).map(p => <PostCard key={p.id} p={p} />)}
            {posts.hasNextPage && (
              <Button variant="line" className="w-full" disabled={posts.isFetchingNextPage} onClick={() => posts.fetchNextPage()}>
                Ver mais posts
              </Button>
            )}
            {posts.data && !posts.data.pages[0]?.posts.length && <p className="text-sm text-muted">Ninguém postou no grupo ainda.</p>}
          </section>
        )}

        <section>
          <h2 className="text-[1.0625rem] font-semibold">Membros</h2>
          <p className="mb-2 text-xs text-muted">Gestores aprovam as trilhas sugeridas e cuidam das trilhas do grupo.{g.canManageGestores ? ' Toque em ⋯ para escolher os gestores.' : ''}</p>
          {g.memberList.length > 5 && (
            <div className="relative mb-2">
              <Icon n="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={memberQuery}
                onChange={e => setMemberQuery(e.target.value)}
                placeholder="Buscar membro por nome ou @"
                className={`${inputCls} pl-9`}
              />
            </div>
          )}
          {(() => {
            const q = memberQuery.trim().toLowerCase();
            const filtered = q ? g.memberList.filter(m => m.name.toLowerCase().includes(q) || m.handle.toLowerCase().includes(q)) : g.memberList;
            return (
          <Card className="divide-y divide-line">
            {filtered.length === 0 && <p className="p-3.5 text-sm text-muted">Ninguém encontrado para “{memberQuery.trim()}”.</p>}
            {filtered.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3.5">
                <Avatar name={m.name} photo={m.photoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {m.id === me?.id && <span className="font-normal text-muted"> (você)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">@{m.handle}</p>
                </div>
                {m.role === 'admin' && <Tag c="rgb(var(--a))">{m.creator ? 'Criador • Gestor' : 'Gestor'}</Tag>}
                {g.canManageGestores && !m.creator && (
                  <IconBtn
                    n="more"
                    label={`Opções de ${m.name}`}
                    onClick={() =>
                      openActions(m.name, [
                        m.role === 'admin'
                          ? { icon: 'x', label: 'Tirar de gestor', run: () => run(() => actions.setRole(g.id, m.id, 'member'), `${m.name} não é mais gestor`) }
                          : { icon: 'verified', label: 'Tornar gestor', run: () => run(() => actions.setRole(g.id, m.id, 'admin'), `${m.name} agora é gestor`) },
                      ])
                    }
                  />
                )}
              </div>
            ))}
          </Card>
            );
          })()}
        </section>
      </div>
    </>
  );
}

/** Lista de trilhas do grupo (ou de sugestões), com o selo do status. */
function TrilhaList({ list, open }: { list: TrilhaDto[]; open: (id: string) => void }) {
  return (
    <Card className="divide-y divide-line">
      {list.map(t => {
        const st = statusTag(t);
        return (
          <button key={t.id} className="flex w-full items-center gap-3 p-3 text-left" onClick={() => open(t.id)}>
            <Cover t={t} className="h-14 w-20 shrink-0 overflow-hidden rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{t.title}</span>
              <span className="block text-xs text-muted">
                {AREA[t.area].name} • {t.tasksCount === 1 ? '1 tarefa' : `${t.tasksCount} tarefas`}
                {t.author && ` • por ${t.author.name}`}
              </span>
              {(st || t.acquired) && (
                <span className="mt-1 flex gap-1">
                  {st && <Tag c={st[1]}>{st[0]}</Tag>}
                  {t.acquired && <Tag c="#16a34a">Importada</Tag>}
                </span>
              )}
            </span>
            <Icon n="chevR" className="h-4 w-4 text-muted" />
          </button>
        );
      })}
    </Card>
  );
}
