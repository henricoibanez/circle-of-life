'use client';

import { AREA, AREAS, type AreaId, type FeedFilter } from '@circle/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type ReactNode } from 'react';
import { Logo, Wordmark } from '@/components/art';
import { Bell } from '@/components/bell';
import { PostCard } from '@/components/feed/post-card';
import { usePostForm } from '@/components/feed/post-form';
import { Icon, type IconName } from '@/components/icon';
import { Avatar, Chips, IconBtn, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import { type FeedParams, useFeed, usePost } from '@/lib/feed';
import { useMe } from '@/lib/me';
import { useFriends, useGroups } from '@/lib/social';

const CHIPS: { id: FeedFilter; label: string }[] = [
  { id: 'para', label: 'Para você' },
  { id: 'amigos', label: 'Amigos' },
  { id: 'grupos', label: 'Grupos' },
  { id: 'seguindo', label: 'Seguindo' },
  { id: 'salvos', label: 'Salvos' },
];

export default function FeedPage() {
  return (
    <Suspense>
      <Feed />
    </Suspense>
  );
}

/** Quem está filtrado pela fileira do topo: uma pessoa ou um grupo. */
type Who = { kind: 'person' | 'group'; id: string; label: string } | null;

function Feed() {
  const params = useSearchParams();
  const router = useRouter();
  const postId = params.get('post');
  const { data: me } = useMe();
  const { data: friends } = useFriends();
  const { data: groups } = useGroups();
  const { openActions } = useSheets();
  const newPost = usePostForm();
  const [chip, setChip] = useState<FeedFilter>('para');
  const [who, setWho] = useState<Who>(null);
  const [area, setArea] = useState<AreaId | null>(null);

  const query: FeedParams = who ? (who.kind === 'person' ? { author: who.id } : { group: who.id }) : { filter: chip, area: area ?? undefined };
  const feed = useFeed(query);
  const single = usePost(postId);
  const posts = feed.data?.pages.flatMap(p => p.posts) ?? [];

  const toggle = (w: NonNullable<Who>) => setWho(who?.id === w.id ? null : w);
  const Story = ({ w, children }: { w: NonNullable<Who>; children: ReactNode }) => (
    <button onClick={() => toggle(w)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
      <span className={`relative grid h-[66px] w-[66px] place-items-center rounded-full ring-offset-2 ring-offset-bg ${who?.id === w.id ? 'ring-[3px] ring-primary' : 'ring-2 ring-primary/40'}`}>
        {children}
      </span>
      <span className="w-full truncate text-center text-xs">{w.label}</span>
    </button>
  );

  return (
    <>
      <header className="sticky z-20 flex items-center gap-2.5 bg-bg/90 px-4 pb-2 pt-3 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <Logo className="h-10 w-10" />
        <Wordmark className="flex-1 text-[24px]" />
        <Bell />
      </header>
      <div className="no-bar flex gap-3 overflow-x-auto px-4 pb-3 pt-2">
        <button onClick={() => newPost()} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
          <span className="grid h-[66px] w-[66px] place-items-center rounded-2xl border border-line bg-surface shadow-soft">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-onprimary">
              <Icon n="plus" sw={2.5} />
            </span>
          </span>
          <span className="text-xs">Criar post</span>
        </button>
        {me && (
          <Story w={{ kind: 'person', id: me.id, label: 'Você' }}>
            <Avatar name={me.name} photo={me.photoUrl} size="w-full h-full text-lg" />
          </Story>
        )}
        {friends?.friends.slice(0, 2).map(f => (
          <Story key={f.id} w={{ kind: 'person', id: f.id, label: f.name.split(' ')[0]! }}>
            <Avatar name={f.name} photo={f.photoUrl} size="w-full h-full text-lg" />
          </Story>
        ))}
        {groups?.mine.slice(0, 2).map(g => (
          <Story key={g.id} w={{ kind: 'group', id: g.id, label: g.name }}>
            <span className="grid h-full w-full place-items-center rounded-full bg-primary text-onprimary">
              <Icon n={g.icon as IconName} className="h-7 w-7" />
            </span>
          </Story>
        ))}
        {friends?.friends.slice(2).map(f => (
          <Story key={f.id} w={{ kind: 'person', id: f.id, label: f.name.split(' ')[0]! }}>
            <Avatar name={f.name} photo={f.photoUrl} size="w-full h-full text-lg" />
          </Story>
        ))}
      </div>
      <div className="space-y-4 px-4 pb-8">
        {postId ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Mostrando um post</span>
              <button className="ml-auto font-semibold text-primary" onClick={() => router.replace('/feed')}>
                Ver o feed
              </button>
            </div>
            {single.data && <PostCard p={single.data} />}
            {single.error && <p className="py-12 text-center text-muted">Esse post não existe mais.</p>}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Chips
                  items={CHIPS}
                  value={who ? '' : chip}
                  onChange={c => {
                    setWho(null);
                    setChip(c as FeedFilter);
                  }}
                />
              </div>
              <IconBtn
                n="sliders"
                label="Filtrar por área"
                className={area ? 'bg-primary/10 text-primary' : ''}
                onClick={() =>
                  openActions('Filtrar por área da vida', [
                    { icon: 'grid', label: 'Todas as áreas', run: () => setArea(null) },
                    ...AREAS.map(a => ({ icon: a.icon as IconName, label: a.name, run: () => setArea(a.id) })),
                  ])
                }
              />
            </div>
            {(who || area) && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Mostrando</span>
                <Tag>{who ? who.label : AREA[area!].name}</Tag>
                <button
                  className="ml-auto font-semibold text-primary"
                  onClick={() => {
                    setWho(null);
                    setArea(null);
                  }}
                >
                  Limpar
                </button>
              </div>
            )}
            {posts.map(p => (
              <PostCard key={p.id} p={p} />
            ))}
            {feed.hasNextPage && (
              <Button variant="line" className="w-full" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
                {feed.isFetchingNextPage ? 'Carregando…' : 'Ver mais posts'}
              </Button>
            )}
            {feed.data && posts.length === 0 && (
              <div className="py-12 text-center">
                <p className="mb-3 text-muted">{chip === 'salvos' && !who ? 'Você ainda não salvou nenhum post.' : 'Nenhum post por aqui.'}</p>
                <Button onClick={() => newPost(undefined, who?.kind === 'group' ? who.id : undefined)}>Criar post</Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
