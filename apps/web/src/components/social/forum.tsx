'use client';

import type { TopicDetailDto, TopicDto } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/confirm';
import { Icon } from '@/components/icon';
import { Avatar, Card, Field, IconBtn, inputCls } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { since } from '@/lib/time';

const topicsKey = (groupId: string) => ['topics', groupId];
const topicKey = (topicId: string) => ['topic', topicId];

/** Fórum do grupo: lista de tópicos (os mais movimentados primeiro) e botão para abrir um novo. */
export function ForumSection({ groupId }: { groupId: string }) {
  const { data } = useQuery({ queryKey: topicsKey(groupId), queryFn: () => api<TopicDto[]>(`/groups/${groupId}/topics`) });
  const { openSheet } = useSheets();
  const open = (id: string) => openSheet(close => <TopicSheet groupId={groupId} topicId={id} onClose={close} />);

  return (
    <section className="space-y-2">
      <div className="flex items-center">
        <h2 className="flex-1 text-[1.0625rem] font-semibold">Fórum</h2>
        <Button variant="aline" className="rounded-full px-3 py-1.5 text-[0.75rem]" onClick={() => openSheet(close => <NewTopicSheet groupId={groupId} onClose={close} onCreated={open} />)}>
          <Icon n="plus" className="h-4 w-4" />
          Novo tópico
        </Button>
      </div>
      {data && data.length > 0 && (
        <Card className="divide-y divide-line">
          {data.map(t => (
            <button key={t.id} onClick={() => open(t.id)} className="flex w-full items-start gap-3 p-3 text-left">
              <Avatar name={t.author.name} photo={t.author.photoUrl} size="w-9 h-9 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.title}</span>
                <span className="block text-xs text-muted">
                  {t.mine ? 'Você' : t.author.name.split(' ')[0]} • {since(t.lastActivityAt)}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-sm text-muted">
                <Icon n="msg" className="h-4 w-4" />
                {t.replies}
              </span>
            </button>
          ))}
        </Card>
      )}
      {data && !data.length && <p className="text-sm text-muted">Ninguém abriu um tópico ainda. Que tal começar a conversa?</p>}
    </section>
  );
}

function NewTopicSheet({ groupId, onClose, onCreated }: { groupId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ title: '', text: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const t = await api<TopicDetailDto>(`/groups/${groupId}/topics`, { method: 'POST', body: { title: f.title.trim(), text: f.text.trim() } });
      qc.setQueryData(topicKey(t.id), t);
      await qc.invalidateQueries({ queryKey: topicsKey(groupId) });
      onClose();
      onCreated(t.id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível abrir o tópico.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title="Novo tópico"
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="accent" className="flex-1" disabled={busy || f.title.trim().length < 3} onClick={save}>
            Publicar tópico
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Assunto">
          <input autoFocus className={inputCls} maxLength={120} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Ex.: O que acharam do canto 1?" />
        </Field>
        <Field label="Texto (opcional)">
          <textarea rows={4} maxLength={3000} className={inputCls} value={f.text} onChange={e => setF({ ...f, text: e.target.value })} placeholder="Conte mais para o grupo" />
        </Field>
        <p className="text-xs text-muted">Os membros do grupo recebem um aviso no sino.</p>
      </div>
    </Sheet>
  );
}

/** Um tópico aberto: o texto, as respostas e o campo para responder. */
export function TopicSheet({ groupId, topicId, onClose }: { groupId: string; topicId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { openSheet } = useSheets();
  const { data: t, error } = useQuery({ queryKey: topicKey(topicId), queryFn: () => api<TopicDetailDto>(`/groups/${groupId}/topics/${topicId}`), retry: false });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = (d?: TopicDetailDto) => {
    if (d) qc.setQueryData(topicKey(topicId), d);
    qc.invalidateQueries({ queryKey: topicsKey(groupId) });
  };
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');

  const send = async () => {
    setBusy(true);
    try {
      refresh(await api<TopicDetailDto>(`/groups/${groupId}/topics/${topicId}/replies`, { method: 'POST', body: { text: text.trim() } }));
      setText('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const removeReply = (id: string) =>
    api<TopicDetailDto>(`/groups/${groupId}/topics/${topicId}/replies/${id}`, { method: 'DELETE' }).then(refresh, fail);
  const removeTopic = () =>
    openSheet(close => (
      <ConfirmSheet
        title="Apagar tópico?"
        confirm="Apagar"
        danger
        onClose={close}
        onConfirm={async () => {
          await api(`/groups/${groupId}/topics/${topicId}`, { method: 'DELETE' }).catch(fail);
          qc.removeQueries({ queryKey: topicKey(topicId) });
          await qc.invalidateQueries({ queryKey: topicsKey(groupId) });
          onClose();
        }}
      >
        O tópico e todas as respostas somem para o grupo.
      </ConfirmSheet>
    ));

  return (
    <Sheet
      title={t?.title ?? 'Tópico'}
      onClose={onClose}
      footer={
        t && (
          <form
            className="flex flex-1 gap-2"
            onSubmit={e => {
              e.preventDefault();
              if (text.trim()) send();
            }}
          >
            <input value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Escreva uma resposta" className={inputCls} />
            <Button type="submit" variant="accent" disabled={busy || !text.trim()} aria-label="Responder">
              <Icon n="send" className="h-4 w-4" />
            </Button>
          </form>
        )
      }
    >
      {error && <p className="py-6 text-center text-muted">{error instanceof ApiError ? error.message : 'Esse tópico não existe mais.'}</p>}
      {t && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Avatar name={t.author.name} photo={t.author.photoUrl} size="w-10 h-10 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {t.mine ? 'Você' : t.author.name} <span className="text-xs font-normal text-muted">{since(t.createdAt)}</span>
              </p>
              {t.text && <p className="mt-1 whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{t.text}</p>}
            </div>
            {(t.mine || t.canModerate) && <IconBtn n="trash" label="Apagar tópico" className="h-8 w-8 text-muted" onClick={removeTopic} />}
          </div>
          <p className="border-t border-line pt-3 text-sm font-semibold text-muted">
            {t.replies === 0 ? 'Nenhuma resposta ainda' : t.replies === 1 ? '1 resposta' : `${t.replies} respostas`}
          </p>
          {t.replyList.map(r => (
            <div key={r.id} className="flex gap-3">
              <Avatar name={r.author.name} photo={r.author.photoUrl} size="w-9 h-9 text-xs" />
              <div className="flex-1 rounded-2xl bg-sunk px-3.5 py-2.5">
                <p className="text-sm font-semibold">
                  {r.mine ? 'Você' : r.author.name} <span className="text-xs font-normal text-muted">{since(r.createdAt)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[0.9375rem]">{r.text}</p>
              </div>
              {(r.mine || t.canModerate) && <IconBtn n="trash" label="Apagar resposta" className="h-8 w-8 self-center text-muted" onClick={() => removeReply(r.id)} />}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
