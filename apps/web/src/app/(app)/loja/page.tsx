'use client';

import { AREA, AREAS, gemsLabel, SOCIAL_UNLOCK_PRICE, STARTER_TRILHA_ID, TRILHA_CATEGORIES } from '@circle/shared';
import { useState } from 'react';
import { StepsArt } from '@/components/art';
import { CoinIcon } from '@/components/coin';
import { Header, InfoSheet } from '@/components/header';
import { Icon, type IconName } from '@/components/icon';
import { AreaIcon, IconBtn, inputCls, MANY_AREAS, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { Cover, priceLabel, TrilhaSheet } from '@/components/trilhas/trilha-sheets';
import { Button } from '@/components/ui/button';
import { useUnlockWithConfirm } from '@/components/journey';
import { daysLeft, freeNow, socialLocked } from '@/lib/journey';
import { useMe } from '@/lib/me';
import { kfmt, useTrilhaActions, useTrilhas } from '@/lib/trilhas';

const CATS: { id: string; label: string; icon: IconName; color?: string }[] = [{ id: 'all', label: 'Todas', icon: 'grid' }, ...TRILHA_CATEGORIES];

/** Loja de trilhas (como no protótipo), com trilhas pagas em gemas e aprovação pelo administrador. */
export default function LojaPage() {
  const { data } = useTrilhas();
  const { data: me } = useMe();
  const actions = useTrilhaActions();
  const { openSheet, openActions } = useSheets();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const open = (id: string) => openSheet(close => <TrilhaSheet id={id} onClose={close} />);

  const isAdmin = me?.role === 'admin';
  // Jornada (decisão do dono de 04/11/2026): até liberar tudo, só a trilha "Primeiros passos" abre; as outras ficam borradas.
  const storeLocked = socialLocked(me);
  const lockedTrilha = (id: string) => storeLocked && id !== STARTER_TRILHA_ID;
  const unlock = useUnlockWithConfirm();
  const free = me?.social.freeAt ? freeNow(me.social) : false;
  const freeAll = () => unlock.start();
  const unlockLabel = free ? 'Liberar de graça' : `Liberar por ${gemsLabel(SOCIAL_UNLOCK_PRICE)}`;
  const countdown = me?.social.freeAt && !free ? `Libera de graça em ${daysLeft(me.social.freeAt) === 1 ? '1 dia' : `${daysLeft(me.social.freeAt)} dias`}` : null;
  const list = (data ?? [])
    .filter(t => (cat === 'all' || t.category === cat) && (!q || (t.title + t.description).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(lockedTrilha(a.id)) - Number(lockedTrilha(b.id)));
  const pending = list.filter(t => t.status === 'pendente');
  // O admin revisa todas as pendentes, inclusive as que ele mesmo publicou.
  const reviewQueue = isAdmin ? pending : [];
  const visible = list.filter(t => t.status !== 'pendente' || (t.mine && !isAdmin));

  return (
    <>
      <Header
        title="Loja de trilhas"
        sub="Encontre trilhas prontas para acelerar sua evolução"
        right={
          <IconBtn
            n="bag"
            label="Minhas trilhas"
            box
            onClick={() => {
              const mine = (data ?? []).filter(t => t.mine || t.acquired);
              openActions(
                'Minhas trilhas',
                mine.length
                  ? mine.map(t => ({ icon: t.mine ? 'share' : 'check', label: `${t.title}${t.mine ? ' (publicada por você)' : ''}`, run: () => open(t.id) }))
                  : [{ icon: 'info', label: 'Nenhuma trilha importada ou publicada ainda', run: () => undefined }],
              );
            }}
          />
        }
      />
      <div className="space-y-4 px-4 pb-8">
        <div className="relative">
          <Icon n="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar trilhas, temas, hábitos…" className={inputCls + ' pl-10'} />
        </div>
        <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4">
          {CATS.map(c => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.8125rem] ${cat === c.id ? 'border-accent bg-accent/5 text-accent' : 'border-line bg-surface'}`}
            >
              <span style={{ color: c.color || 'rgb(var(--a))' }}>
                <Icon n={c.icon} className="h-4 w-4" />
              </span>
              {c.label}
            </button>
          ))}
        </div>

        {reviewQueue.length > 0 && (
          <section className="space-y-2 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="flex items-center gap-2 font-semibold text-amber-700">
              <Icon n="alert" className="h-5 w-5" />
              {reviewQueue.length} {reviewQueue.length === 1 ? 'trilha aguardando' : 'trilhas aguardando'} sua aprovação
            </p>
            <p className="text-xs text-muted">Abra a trilha, confira o épico e as tarefas e aprove ou recuse.</p>
          </section>
        )}

        {storeLocked && (
          <section className="flex items-start gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Icon n="lock" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Por enquanto, só a sua primeira trilha</p>
              <p className="mt-0.5 text-sm text-muted">
                As outras trilhas abrem quando você concluir a sua Jornada{countdown ? `: ${countdown.toLowerCase()}, ou agora, por ${gemsLabel(SOCIAL_UNLOCK_PRICE)}.` : '.'}
              </p>
              {me?.journeyFinished && (
                <Button className="mt-3" disabled={unlock.busy} onClick={freeAll}>
                  {unlockLabel}
                </Button>
              )}
            </div>
          </section>
        )}

        <div className="relative overflow-hidden rounded-3xl bg-accent/[.06] p-5">
          <StepsArt className="absolute bottom-0 right-0 w-44 opacity-95" />
          <div className="relative max-w-[60%]">
            <p className="flex items-center gap-1 text-[0.8125rem] font-medium text-accent">
              <Icon n="sparkles" className="h-4 w-4" />
              Recomendadas para você
            </p>
            <p className="mt-1 text-[1.375rem] font-semibold leading-tight">Trilhas feitas para transformar sua vida</p>
            <p className="mt-1.5 text-[0.8125rem] text-muted">Épicos prontos, com as tarefas, para gerar resultados reais.</p>
            <Button variant="accent" className="mt-3" onClick={() => setCat('all')}>
              Explorar trilhas
            </Button>
          </div>
        </div>

        <h2 className="text-[1.0625rem] font-semibold">Trilhas em destaque</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...reviewQueue, ...visible].map(t => {
            const locked = lockedTrilha(t.id);
            const blurred = locked || (t.status === 'pendente' && !t.mine);
            return (
              <div key={t.id} className="relative flex flex-col rounded-2xl border border-line/80 bg-surface p-2 shadow-soft">
                <div className={blurred ? 'pointer-events-none select-none blur-[0.1875rem]' : ''}>
                  <div className="relative">
                    <Cover t={t} className="aspect-[4/3] w-full overflow-hidden rounded-xl" />
                    {!blurred && (
                      <button
                        aria-label={t.favorite ? 'Remover dos favoritos' : 'Favoritar'}
                        onClick={() => actions.favorite(t.id, !t.favorite)}
                        className="pointer-events-auto absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-ink"
                      >
                        <span className={t.favorite ? 'text-red-500' : ''}>
                          <Icon n="heart" className="h-4 w-4" fill={t.favorite ? 'currentColor' : 'none'} />
                        </span>
                      </button>
                    )}
                  </div>
                  <p className="mt-2 px-0.5 text-[0.875rem] font-semibold leading-tight">{t.title}</p>
                  <p className="mt-1 line-clamp-3 px-0.5 text-[0.7188rem] leading-snug text-muted">{t.description}</p>
                  <div className="mt-2 flex items-center gap-1.5 px-0.5 text-[0.6875rem] text-muted">
                    <AreaIcon id={t.area} areas={t.areas} size="w-6 h-6" icon="w-3.5 h-3.5" />
                    <span className="truncate">{t.areas.length >= MANY_AREAS ? (t.areas.length >= AREAS.length ? 'Todas as áreas' : `${t.areas.length} áreas`) : AREA[t.area].name}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 px-0.5 text-[0.6875rem] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Icon n="list" className="h-3.5 w-3.5" />
                      {t.tasksCount} tarefas
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1">
                      <Icon n="download" className="h-3.5 w-3.5" />
                      {kfmt(t.downloads)}
                    </span>
                  </div>
                  <div className="mt-1.5 px-0.5">
                    <Tag c={t.priceGems ? '#b7791f' : '#16a34a'} className="inline-flex items-center gap-1">{t.priceGems > 0 && <CoinIcon className="h-3.5 w-3.5" />}{priceLabel(t)}</Tag>
                    {t.mine && t.status === 'pendente' && <Tag c="#d97706" className="ml-1">Em análise</Tag>}
                    {t.mine && t.status === 'recusada' && <Tag c="#dc2626" className="ml-1">Recusada</Tag>}
                  </div>
                </div>
                {locked ? (
                  <span className="absolute inset-x-2 top-1/4 flex flex-col items-center gap-1 rounded-xl bg-surface/95 px-2 py-2 text-center shadow-soft">
                    <Icon n="lock" className="h-4 w-4 text-primary" />
                    <span className="text-[0.75rem] font-semibold">{countdown ?? 'Abre ao concluir a Jornada'}</span>
                  </span>
                ) : (
                  blurred && (
                    <span className="absolute inset-x-2 top-1/3 rounded-xl bg-surface/90 px-2 py-1.5 text-center text-[0.75rem] font-semibold text-amber-700 shadow-soft">
                      Aguardando aprovação
                    </span>
                  )
                )}
                {locked ? (
                  <Button className="mt-2.5 py-2 text-[0.8125rem]" disabled={!me?.journeyFinished || unlock.busy} onClick={freeAll}>
                    {unlockLabel}
                  </Button>
                ) : (
                  <Button variant="aline" className="mt-2.5 py-2 text-[0.8125rem]" onClick={() => open(t.id)}>
                    {t.status === 'pendente' && isAdmin ? 'Revisar' : t.acquired ? 'Importada' : 'Ver detalhes'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {data && !list.length && <p className="py-6 text-center text-muted">Nenhuma trilha encontrada.</p>}

        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <span className="text-primary">
            <Icon n="verified" className="h-10 w-10" sw={1.4} />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Importe para o seu Backlog</p>
            <p className="text-xs text-muted">Ao importar, você escolhe a iniciativa e o épico entra no seu backlog com todas as tarefas.</p>
          </div>
          <Button variant="pline" className="rounded-full px-3 py-1.5 text-[0.75rem]" onClick={() => openSheet(close => <InfoSheet k="loja" onClose={close} />)}>
            Entenda como funciona
          </Button>
        </div>
      </div>
    </>
  );
}
