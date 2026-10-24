'use client';

import { AREA } from '@circle/shared';
import { useParams, useRouter } from 'next/navigation';
import { ConfirmSheet } from '@/components/confirm';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { Avatar, Card, Empty, IconBtn, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { AddTrilhaSheet, GroupCover, GroupForm } from '@/components/social/group-sheets';
import { useToast } from '@/components/toasts';
import { Cover, priceLabel, TrilhaSheet } from '@/components/trilhas/trilha-sheets';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { mix } from '@/lib/color';
import { useMe } from '@/lib/me';
import { useGroup, useSocialActions } from '@/lib/social';

/** Página de um grupo: membros e trilhas escolhidas pelo administrador. */
export default function GrupoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: g, error } = useGroup(id);
  const { data: me } = useMe();
  const actions = useSocialActions();
  const toast = useToast();
  const { openSheet, openActions } = useSheets();

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

  const menu = () =>
    openActions(g.name, [
      g.admin && { icon: 'edit', label: 'Editar grupo', run: () => openSheet(close => <GroupForm group={g} onClose={close} />) },
      g.admin && { icon: 'plus', label: 'Adicionar trilha', run: () => openSheet(close => <AddTrilhaSheet group={g} onClose={close} />) },
      g.member && {
        icon: 'x',
        label: 'Sair do grupo',
        run: () =>
          openSheet(close => (
            <ConfirmSheet title={`Sair de ${g.name}?`} confirm="Sair" onConfirm={() => run(() => actions.leave(g.id), `Você saiu de ${g.name}`)} onClose={close}>
              {g.admin && g.memberList.filter(m => m.role === 'admin').length === 1 && g.members > 1
                ? 'Você é o único administrador. O membro mais antigo passa a administrar o grupo.'
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
              O grupo some para todos os membros. As trilhas continuam na loja.
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
            <p className="flex flex-wrap items-center gap-2 text-[21px] font-semibold">
              {g.name}
              {g.admin && <span className="rounded-md border border-white/20 bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">Administrador</span>}
            </p>
            {g.description && <p className="mt-1 text-[14px] text-white/85">{g.description}</p>}
            <p className="mt-3 flex items-center gap-3 text-[12px] text-white/85">
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
          <div className="mb-2 flex items-center">
            <h2 className="flex-1 text-[17px] font-semibold">Trilhas do grupo</h2>
            {g.admin && (
              <Button variant="aline" className="rounded-full px-3 py-1.5 text-[12px]" onClick={() => openSheet(close => <AddTrilhaSheet group={g} onClose={close} />)}>
                <Icon n="plus" className="h-4 w-4" />
                Adicionar
              </Button>
            )}
          </div>
          {g.trilhaList.length ? (
            <Card className="divide-y divide-line">
              {g.trilhaList.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3">
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openSheet(close => <TrilhaSheet id={t.id} onClose={close} />)}>
                    <Cover t={t} className="h-14 w-20 shrink-0 overflow-hidden rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.title}</span>
                      <span className="block text-xs text-muted">
                        {t.tasksCount} tarefas • {priceLabel(t)}
                      </span>
                      {t.acquired && (
                        <Tag c="#16a34a" className="mt-1">
                          Importada
                        </Tag>
                      )}
                    </span>
                  </button>
                  {g.admin && (
                    <IconBtn
                      n="x"
                      label={`Tirar ${t.title} do grupo`}
                      onClick={() => run(() => actions.removeTrilha(g.id, t.id), 'Trilha retirada do grupo')}
                    />
                  )}
                </div>
              ))}
            </Card>
          ) : (
            <p className="text-sm text-muted">{g.admin ? 'Escolha trilhas da loja para o grupo seguir junto.' : 'O administrador ainda não escolheu trilhas.'}</p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-[17px] font-semibold">Membros</h2>
          <Card className="divide-y divide-line">
            {g.memberList.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3.5">
                <Avatar name={m.name} photo={m.photoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {m.id === me?.id && <span className="font-normal text-muted"> (você)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">@{m.handle}</p>
                </div>
                {m.role === 'admin' && <Tag c="rgb(var(--a))">Administrador</Tag>}
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
