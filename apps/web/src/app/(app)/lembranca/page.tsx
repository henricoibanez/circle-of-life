'use client';

import { AREA, type AreaId, type MemoryDto } from '@circle/shared';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PostForm } from '@/components/feed/post-form';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { AreaIcons, Card, Empty } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { socialLocked } from '@/lib/journey';
import { useMe } from '@/lib/me';

const KIND = { task: 'Tarefa concluída', epic: 'Épico encerrado', initiative: 'Iniciativa concluída' } as const;
const VERB = { task: 'concluí', epic: 'encerrei o épico', initiative: 'concluí a iniciativa' } as const;

/** "Lembra disso?": uma conquista de meses atrás, com foto e detalhes (abre pela notificação). */
export default function LembrancaPage() {
  return (
    <>
      <Header title="Lembra disso?" sub="Uma conquista sua" fallback="/feed" />
      <Suspense>
        <Memory />
      </Suspense>
    </>
  );
}

function Memory() {
  const params = useSearchParams();
  const kind = params.get('tipo');
  const id = params.get('id');
  const { data: me } = useMe();
  const { openSheet } = useSheets();
  const { data, error } = useQuery({
    queryKey: ['memory', kind, id],
    queryFn: () => api<MemoryDto>(`/memories/${kind}/${id}`),
    enabled: Boolean(kind && id),
  });
  if (error || !kind || !id) return <Empty>Essa conquista não existe mais.</Empty>;
  if (!data) return null;
  const areas = data.areas.filter((a): a is AreaId => a in AREA);
  const share = () =>
    openSheet(close => (
      <PostForm
        draft={{
          title: data.title,
          text: `${data.ago} eu ${VERB[data.kind]} “${data.title}”. Que lembrança boa!`,
          area: areas[0] ?? null,
          refType: data.kind,
          refId: data.id,
        }}
        onClose={close}
      />
    ));

  return (
    <div className="space-y-4 px-4 pb-8">
      <Card className="overflow-hidden">
        {data.imageUrl ? (
          <img src={data.imageUrl} alt="" className="max-h-80 w-full object-cover" />
        ) : (
          <div className="grid h-32 place-items-center bg-primary/10 text-primary">
            <Icon n="trophy" className="h-12 w-12" />
          </div>
        )}
        <div className="space-y-2 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{KIND[data.kind]}</p>
          <h2 className="text-xl font-bold leading-snug">{data.title}</h2>
          <p className="text-sm text-muted">
            {data.ago} · {new Date(data.doneAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          {areas.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AreaIcons areas={areas} />
              <span className="text-muted">{areas.length === 1 ? AREA[areas[0]!].name : `${areas.length} áreas da vida`}</span>
            </div>
          )}
          {(data.initiative || data.epic) && <p className="text-sm text-muted">{[data.initiative, data.epic].filter(Boolean).join(' › ')}</p>}
          {data.tasks !== null && <p className="text-sm text-muted">{data.tasks === 1 ? '1 tarefa' : `${data.tasks} tarefas`}</p>}
          {data.description && <p className="whitespace-pre-line pt-1 text-[0.9375rem]">{data.description}</p>}
        </div>
      </Card>
      {!socialLocked(me) && (
        <Button className="w-full" onClick={share}>
          <Icon n="share" className="h-4 w-4" />
          Compartilhar
        </Button>
      )}
    </div>
  );
}
