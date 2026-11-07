'use client';

import type { SurveyDto } from '@circle/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Card, Empty } from '@/components/primitives';
import { SurveyStars } from '@/components/survey';
import { api } from '@/lib/api';

/** Pesquisa rápida: a notificação do celular abre aqui (o celular não tem espaço para as 5 estrelas). */
export default function PesquisaPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useQuery({ queryKey: ['survey', id], queryFn: () => api<SurveyDto>(`/surveys/${id}`) });
  return (
    <>
      <Header title="Pesquisa rápida" sub="Sua opinião ajuda a melhorar o app" fallback="/feed" />
      <div className="px-4 pb-8">
        {error && <Empty>Essa pesquisa não está disponível.</Empty>}
        {data && (
          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-semibold leading-snug">{data.question}</h2>
            <SurveyStars survey={data} />
          </Card>
        )}
      </div>
    </>
  );
}
