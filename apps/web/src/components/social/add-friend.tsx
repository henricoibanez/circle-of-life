'use client';

import type { PersonSearchDto } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { Avatar, Card, inputCls } from '@/components/primitives';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useSocialActions } from '@/lib/social';

/** Adicionar amigo: conforme a pessoa digita, aparecem as pessoas do app (por nome ou @ID) para escolher. */
export function AddFriend() {
  const actions = useSocialActions();
  const toast = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // Espera a pessoa parar de digitar um instante antes de buscar.
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ['people', term],
    queryFn: () => api<PersonSearchDto[]>(`/friends/search?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
  });

  const act = async (p: PersonSearchDto) => {
    setBusy(p.id);
    try {
      if (p.relation === 'recebido' && p.requestId) {
        await actions.accept(p.requestId);
        toast(`Você e ${p.name.split(' ')[0]} agora são amigos`);
      } else {
        const r = await actions.request(p.handle);
        toast(r.status === 'amigos' ? `Você e ${p.name.split(' ')[0]} agora são amigos` : `Pedido enviado para ${p.name.split(' ')[0]}`);
      }
      await qc.invalidateQueries({ queryKey: ['people'] });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível enviar o pedido.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-4">
      <h2 className="mb-2 font-semibold">Adicionar amigo</h2>
      <div className="relative">
        <Icon n="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Digite o nome ou o @ID"
          className={inputCls + ' pl-10'}
          autoCapitalize="none"
          autoComplete="off"
          aria-label="Buscar pessoas"
        />
      </div>
      {term.length >= 2 && (
        <div className="mt-2 divide-y divide-line">
          {data?.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <Avatar name={p.name} photo={p.photoUrl} size="w-9 h-9 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted">@{p.handle}</p>
              </div>
              {p.relation === 'amigo' ? (
                <span className="text-xs font-semibold text-primary">Amigos</span>
              ) : p.relation === 'enviado' ? (
                <span className="text-xs text-muted">Pedido enviado</span>
              ) : (
                <Button variant={p.relation === 'recebido' ? 'asoft' : 'accent'} className="px-3 py-1.5" disabled={busy === p.id} onClick={() => act(p)}>
                  {p.relation === 'recebido' ? 'Aceitar' : 'Adicionar'}
                </Button>
              )}
            </div>
          ))}
          {data && !data.length && !isFetching && <p className="py-3 text-sm text-muted">Ninguém com esse nome no Circle of Life.</p>}
        </div>
      )}
      {q.trim().length > 0 && q.trim().length < 2 && <p className="mt-2 text-xs text-muted">Digite pelo menos 2 letras.</p>}
    </Card>
  );
}
