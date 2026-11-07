'use client';

import type { ReleaseDto } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/confirm';
import { Header } from '@/components/header';
import { Card, Field, inputCls, Tag } from '@/components/primitives';
import { ReleaseBody } from '@/components/release';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';

const KEY = ['admin', 'releases'];
const EMPTY = { version: '', title: '', body: '' };
const date = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Só administradores: escrever as novidades de uma versão e publicar. Ao publicar, todo
 * mundo fora da Jornada recebe a notificação, que abre a tela da novidade.
 */
export default function NovidadesAdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { openSheet } = useSheets();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => api<ReleaseDto[]>('/admin/releases') });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      qc.invalidateQueries({ queryKey: KEY });
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Algo deu errado.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const ok = await run(
      () => (editing ? api(`/admin/releases/${editing}`, { method: 'PATCH', body: form }) : api('/admin/releases', { method: 'POST', body: form })),
      'Rascunho salvo.',
    );
    if (ok) {
      setForm(EMPTY);
      setEditing(null);
      setPreview(false);
    }
  };
  const publish = (r: ReleaseDto) =>
    openSheet(close => (
      <ConfirmSheet
        title="Publicar novidade"
        confirm="Publicar"
        onClose={close}
        onConfirm={() =>
          run(async () => {
            const res = await api<{ notified: number }>(`/admin/releases/${r.id}/publish`, { method: 'POST' });
            toast(`Publicada. ${res.notified} ${res.notified === 1 ? 'pessoa recebeu' : 'pessoas receberam'} a notificação.`);
          }, 'Novidade publicada.')
        }
      >
        Todo mundo fora da Jornada recebe a notificação “Novidades da versão {r.version}”. Depois de publicada, ela não pode mais ser mudada.
      </ConfirmSheet>
    ));
  const remove = (r: ReleaseDto) =>
    openSheet(close => (
      <ConfirmSheet title="Apagar rascunho" confirm="Apagar" danger onClose={close} onConfirm={() => run(() => api(`/admin/releases/${r.id}`, { method: 'DELETE' }), 'Rascunho apagado.')}>
        O rascunho “{r.title}” será apagado.
      </ConfirmSheet>
    ));
  const valid = form.version.trim() && form.title.trim() && form.body.trim();

  return (
    <>
      <Header title="Novidades" sub="O que mudou em cada versão do app" />
      <div className="space-y-5 px-4 pb-8">
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">{editing ? 'Editar rascunho' : 'Nova novidade'}</h2>
          <div className="flex gap-2">
            <div className="w-28">
              <Field label="Versão">
                <input className={inputCls} placeholder="1.4" maxLength={20} value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Título">
                <input className={inputCls} placeholder="Notificações mais inteligentes" maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </Field>
            </div>
          </div>
          <Field label="O que mudou">
            <textarea
              rows={7}
              maxLength={5000}
              className={inputCls}
              placeholder={'Escreva em frases curtas.\n\n- Linhas que começam com "- " viram lista\n- Uma linha em branco separa os parágrafos'}
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
            />
          </Field>
          {preview && form.body.trim() && (
            <div className="rounded-xl border border-dashed border-line p-4">
              <p className="mb-2 text-xs font-semibold text-muted">Pré-visualização</p>
              <ReleaseBody text={form.body} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!valid || busy} onClick={save}>
              Salvar rascunho
            </Button>
            <Button variant="line" disabled={!form.body.trim()} onClick={() => setPreview(!preview)}>
              {preview ? 'Esconder prévia' : 'Pré-visualizar'}
            </Button>
            {editing && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY);
                }}
              >
                Cancelar edição
              </Button>
            )}
          </div>
        </Card>

        <section className="space-y-3">
          {data?.length === 0 && <p className="px-1 text-sm text-muted">Nenhuma novidade ainda.</p>}
          {data?.map(r => (
            <Card key={r.id} className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Tag>Versão {r.version}</Tag>
                <span className={`rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold ${r.publishedAt ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-700'}`}>
                  {r.publishedAt ? `Publicada em ${date(r.publishedAt)}` : 'Rascunho'}
                </span>
              </div>
              <p className="font-semibold">{r.title}</p>
              <ReleaseBody text={r.body} />
              {!r.publishedAt && (
                <div className="flex flex-wrap gap-3 pt-1">
                  <button disabled={busy} className="text-sm font-semibold text-primary disabled:opacity-40" onClick={() => publish(r)}>
                    Publicar
                  </button>
                  <button
                    disabled={busy}
                    className="text-sm font-semibold disabled:opacity-40"
                    onClick={() => {
                      setEditing(r.id);
                      setForm({ version: r.version, title: r.title, body: r.body });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Editar
                  </button>
                  <button disabled={busy} className="text-sm font-semibold text-red-600 disabled:opacity-40" onClick={() => remove(r)}>
                    Apagar
                  </button>
                </div>
              )}
            </Card>
          ))}
        </section>
      </div>
    </>
  );
}
