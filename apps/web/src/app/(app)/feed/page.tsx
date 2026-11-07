'use client';

import { AREA, AREAS, type AreaId, type FeedFilter } from '@circle/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Logo, Wordmark } from '@/components/art';
import { Bell } from '@/components/bell';
import { PostCard } from '@/components/feed/post-card';
import { StoryRow } from '@/components/feed/stories';
import { usePostForm } from '@/components/feed/post-form';
import { Icon, type IconName } from '@/components/icon';
import { Chips, IconBtn, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import { type FeedParams, useFeed, usePost } from '@/lib/feed';
import { freeNow, journeyActive } from '@/lib/journey';
import { useMe } from '@/lib/me';

const CHIPS: { id: FeedFilter; label: string }[] = [
  { id: 'para', label: 'Para você' },
  { id: 'amigos', label: 'Amigos' },
  { id: 'grupos', label: 'Grupos' },
  { id: 'seguindo', label: 'Seguindo' },
  { id: 'salvos', label: 'Salvos' },
];

export default function FeedPage() {
  const router = useRouter();
  const { data: me } = useMe();
  // Quem está na Jornada de primeiro acesso vê a Jornada no lugar do Feed.
  // Durante a espera dos 7 dias, a tela principal é o Board; passado o prazo, a Jornada (para concluir).
  useEffect(() => {
    if (journeyActive(me)) router.replace(me!.journeyFinished && !freeNow(me!.social) ? '/board' : '/jornada');
  }, [me, router]);
  if (!me || journeyActive(me)) return null;
  return (
    <Suspense>
      <Feed />
    </Suspense>
  );
}

function Feed() {
  const params = useSearchParams();
  const router = useRouter();
  const postId = params.get('post');
  const { openActions } = useSheets();
  const newPost = usePostForm();
  const [chip, setChip] = useState<FeedFilter>('para');
  const [area, setArea] = useState<AreaId | null>(null);

  // "/feed?novo=post" (dica "Aconteceu algo bom?") abre o formulário de post.
  const novo = params.get('novo');
  useEffect(() => {
    if (novo !== 'post') return;
    router.replace('/feed');
    newPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novo]);

  const query: FeedParams = { filter: chip, area: area ?? undefined };
  const feed = useFeed(query);
  const single = usePost(postId);
  const posts = feed.data?.pages.flatMap(p => p.posts) ?? [];

  return (
    <>
      <header className="sticky z-20 flex items-center gap-2.5 bg-bg/90 px-4 pb-2 pt-3 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <Logo className="h-10 w-10" />
        <Wordmark className="flex-1 text-[1.5rem]" />
        <Bell />
      </header>
      <StoryRow storyId={params.get('story')} />
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
                  value={chip}
                  onChange={c => setChip(c as FeedFilter)}
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
            {area && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Mostrando</span>
                <Tag>{AREA[area].name}</Tag>
                <button
                  className="ml-auto font-semibold text-primary"
                  onClick={() => setArea(null)}
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
                <p className="mb-3 text-muted">{chip === 'salvos' ? 'Você ainda não salvou nenhum post.' : 'Nenhum post por aqui.'}</p>
                <Button onClick={() => newPost()}>Criar post</Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
