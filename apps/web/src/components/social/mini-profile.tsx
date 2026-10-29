'use client';

import { AREA } from '@circle/shared';
import Link from 'next/link';
import { ConfirmSheet } from '@/components/confirm';
import { Icon } from '@/components/icon';
import { AreaIcon, Avatar, Card } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useProfile, useSocialActions } from '@/lib/social';

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

/** Modal de mini-perfil, aberto ao tocar na foto de alguém. */
function MiniProfile({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: p, isLoading } = useProfile(id);
  const actions = useSocialActions();
  const toast = useToast();
  const { openSheet } = useSheets();
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');

  return (
    <Sheet title="" onClose={onClose}>
      {isLoading || !p ? (
        <p className="py-10 text-center text-muted">Abrindo…</p>
      ) : (
        <div className="pb-2">
          <div className="flex flex-col items-center text-center">
            <Avatar name={p.name} photo={p.photoUrl} size="w-20 h-20 text-2xl" />
            <p className="mt-3 text-xl font-bold">{p.name}</p>
            <p className="text-sm text-muted">@{p.handle}</p>
            {p.bio && !p.blocked && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink/80">{p.bio}</p>}
          </div>

          {p.blocked ? (
            <p className="mt-4 rounded-xl bg-sunk px-3.5 py-3 text-center text-sm text-muted">
              Você bloqueou essa pessoa. Vocês não aparecem um para o outro no feed, stories e busca.
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat value={p.achievements} label={p.achievements === 1 ? 'conquista' : 'conquistas'} />
                <Stat value={p.xpTotal.toLocaleString('pt-BR')} label="XP total" />
                <Stat value={p.mutualFriends} label={p.mutualFriends === 1 ? 'amigo em comum' : 'amigos em comum'} />
              </div>

              {p.topAreas.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold text-muted">Evolui mais em</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.topAreas.map(a => (
                      <span key={a} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm" style={{ color: AREA[a].color, background: `${AREA[a].color}1f` }}>
                        <AreaIcon id={a} size="w-5 h-5" icon="w-3 h-3" />
                        {AREA[a].name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-1.5 text-sm text-muted">
                <p className="flex items-center gap-2">
                  <Icon n="calendar" className="h-4 w-4" />
                  No Circle of Life desde {monthYear(p.memberSince)}
                </p>
                {p.sharedGroups.length > 0 && (
                  <p className="flex items-start gap-2">
                    <Icon n="users" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Vocês dois estão em {p.sharedGroups.join(', ')}</span>
                  </p>
                )}
              </div>
            </>
          )}

          <div className="mt-5 space-y-2">
            {p.isMe ? (
              <Link href="/perfil" onClick={onClose}>
                <Button className="w-full">Ver meu perfil</Button>
              </Link>
            ) : (
              <>
                {p.blocked ? (
                  <Button variant="line" className="w-full" onClick={() => actions.unblock(p.id).then(() => toast(`${p.name} foi desbloqueado`), fail)}>
                    Desbloquear
                  </Button>
                ) : (
                  <>
                    {p.relation === 'amigo' && (
                      <p className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 font-semibold text-primary">
                        <Icon n="verified" className="h-4 w-4" />
                        Vocês são amigos
                      </p>
                    )}
                    {p.relation === 'enviado' && (
                      <Button variant="line" className="w-full" disabled>
                        Pedido enviado
                      </Button>
                    )}
                    {p.relation === 'recebido' && p.requestId && (
                      <Button className="w-full" onClick={() => actions.accept(p.requestId!).then(() => toast('Agora vocês são amigos'), fail)}>
                        Aceitar amizade
                      </Button>
                    )}
                    {p.canAddFriend && (
                      <Button className="w-full" onClick={() => actions.request(`@${p.handle}`).then(() => toast('Pedido de amizade enviado'), fail)}>
                        <Icon n="userPlus" className="h-4 w-4" />
                        Adicionar amigo
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={() =>
                        openSheet(close => (
                          <ConfirmSheet
                            title={`Bloquear ${p.name}?`}
                            confirm="Bloquear"
                            danger
                            onConfirm={() => actions.block(p.id).then(() => toast(`${p.name} foi bloqueado`), fail)}
                            onClose={close}
                          >
                            Vocês deixam de aparecer um para o outro no feed, nos stories e na busca, e não podem ser amigos. Dá para desbloquear depois.
                          </ConfirmSheet>
                        ))
                      }
                    >
                      Bloquear
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <Card className="p-3">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </Card>
  );
}

/** Abre o mini-perfil de uma pessoa: `const openProfile = useMiniProfile(); openProfile(userId)`. */
export function useMiniProfile() {
  const { openSheet } = useSheets();
  return (userId: string) => openSheet(close => <MiniProfile id={userId} onClose={close} />);
}
