'use client';

import type { ReleaseDto } from '@circle/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Card, Empty, Tag } from '@/components/primitives';
import { ReleaseBody } from '@/components/release';
import { api } from '@/lib/api';

/** Novidades de uma versão: abre pela notificação do sino (por enquanto, só por lá). */
export default function NovidadePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useQuery({ queryKey: ['release', id], queryFn: () => api<ReleaseDto>(`/releases/${id}`) });
  return (
    <>
      <Header title="Novidades" sub="O que mudou no Circle of Life" fallback="/feed" />
      <div className="px-4 pb-8">
        {error && <Empty>Essa novidade não existe mais.</Empty>}
        {data && (
          <Card className="space-y-3 p-5">
            <Tag>Versão {data.version}</Tag>
            <h2 className="text-xl font-bold leading-snug">{data.title}</h2>
            {data.publishedAt && <p className="text-xs text-muted">{new Date(data.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>}
            <ReleaseBody text={data.body} />
          </Card>
        )}
      </div>
    </>
  );
}
