'use client';

import { TRILHA_CATEGORIES, type TrilhaCategory, type TrilhaDto } from '@circle/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Art } from '@/components/art';
import { Icon } from '@/components/icon';
import { AreaIcon, Field, inputCls, Seg, Tag } from '@/components/primitives';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useBacklog } from '@/lib/backlog';
import { useMe } from '@/lib/me';
import { useTrilha, useTrilhaActions } from '@/lib/trilhas';
import { uploadImage } from '@/lib/upload';

/** Capa da trilha: imagem enviada ou ilustração com texto (como no protótipo). */
export function Cover({ t, className }: { t: Pick<TrilhaDto, 'art' | 'color' | 'coverText' | 'coverUrl'>; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {t.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Art v={t.art} c={t.color} className="h-full w-full" />
      )}
      {t.coverText && (
        <p className="absolute inset-0 grid place-items-center whitespace-pre-line text-center font-serif text-[17px] leading-tight tracking-wide text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
          {t.coverText}
        </p>
      )}
    </div>
  );
}

export const priceLabel = (t: Pick<TrilhaDto, 'priceXp'>) => (t.priceXp ? `${t.priceXp.toLocaleString('pt-BR')} XP` : 'Grátis');

const STATUS_TAG: Record<string, [string, string]> = {
  pendente: ['Aguardando aprovação', '#d97706'],
  recusada: ['Recusada', '#dc2626'],
  despublicada: ['Fora da loja', '#6b7280'],
};

/** Detalhe da trilha: épicos e tarefas, importar/comprar; para admin, aprovar ou recusar. */
export function TrilhaSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: t } = useTrilha(id);
  const { data: me } = useMe();
  const actions = useTrilhaActions();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmBuy, setConfirmBuy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  if (!t || !me) return null;

  const isAdmin = me.role === 'admin';
  const needsPayment = t.priceXp > 0 && !t.acquired && !t.mine;
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const doImport = () =>
    run(async () => {
      const r = await actions.import(id);
      onClose();
      toast(r.paid ? `Trilha comprada por ${r.paid} XP e importada para o backlog` : 'Trilha importada para o backlog');
      router.push('/backlog');
    });

  let footer;
  if (t.status === 'pendente' && isAdmin && !rejecting) {
    footer = (
      <>
        <Button variant="line" className="flex-1" disabled={busy} onClick={() => setRejecting(true)}>
          Recusar
        </Button>
        <Button className="flex-1" disabled={busy} onClick={() => run(() => actions.approve(id), 'Trilha aprovada e publicada na loja')}>
          <Icon n="checkCircle" className="h-4 w-4" />
          Aprovar
        </Button>
      </>
    );
  } else if (rejecting) {
    footer = (
      <>
        <Button variant="line" className="flex-1" onClick={() => setRejecting(false)}>
          Voltar
        </Button>
        <Button className="flex-1 !bg-red-600 !text-white" disabled={busy} onClick={() => run(() => actions.reject(id, reason), 'Trilha recusada').then(ok => ok && onClose())}>
          Recusar trilha
        </Button>
      </>
    );
  } else if (t.status === 'aprovada') {
    footer = confirmBuy ? (
      <>
        <Button variant="line" className="flex-1" onClick={() => setConfirmBuy(false)}>
          Cancelar
        </Button>
        <Button variant="accent" className="flex-1" disabled={busy || me.xp.disponivel < t.priceXp} onClick={doImport}>
          Comprar por {priceLabel(t)}
        </Button>
      </>
    ) : (
      <Button variant="accent" className="flex-1" disabled={busy} onClick={() => (needsPayment ? setConfirmBuy(true) : doImport())}>
        {needsPayment ? `Comprar por ${priceLabel(t)}` : t.acquired ? 'Importar novamente' : 'Importar para o backlog'}
      </Button>
    );
  }

  return (
    <Sheet title={t.title} onClose={onClose} footer={footer}>
      <Cover t={t} className="mb-3 aspect-[16/9] w-full overflow-hidden rounded-2xl" />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Tag c={t.priceXp ? '#7c4dde' : '#16a34a'}>{priceLabel(t)}</Tag>
        {STATUS_TAG[t.status] && <Tag c={STATUS_TAG[t.status]![1]}>{t.mine && t.status === 'pendente' ? 'Em análise' : STATUS_TAG[t.status]![0]}</Tag>}
        <span className="text-xs text-muted">por {t.author ? `${t.author.name} (@${t.author.handle})` : 'Circle of Life'}</span>
      </div>
      <p className="text-[15px] text-ink/80">{t.description}</p>
      {t.rejectionReason && t.status === 'recusada' && (
        <p className="mt-3 rounded-xl bg-red-500/5 px-3 py-2 text-sm text-red-700">Motivo da recusa: {t.rejectionReason}</p>
      )}
      {confirmBuy && (
        <p className="mt-3 rounded-xl bg-accent/5 px-3 py-2 text-sm">
          Você tem <strong>{me.xp.disponivel.toLocaleString('pt-BR')} XP disponíveis</strong>.{' '}
          {me.xp.disponivel < t.priceXp ? 'Não é suficiente para esta trilha.' : `Depois da compra ficam ${(me.xp.disponivel - t.priceXp).toLocaleString('pt-BR')} XP. Seu XP total não muda.`}
        </p>
      )}
      {rejecting && (
        <Field label="Motivo (opcional, o autor vai ver)">
          <textarea rows={3} maxLength={500} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: Detalhe melhor as tarefas da segunda semana." />
        </Field>
      )}
      <div className="mt-3 flex gap-1.5">
        {t.areas.map(a => (
          <AreaIcon key={a} id={a} size="w-7 h-7" icon="w-4 h-4" />
        ))}
      </div>
      {t.epics.map(ep => (
        <div key={ep.id} className="mt-4">
          <p className="flex items-center gap-2 font-semibold">
            {ep.title}
            <Tag c="#7c4dde">Épico</Tag>
          </p>
          <ul className="mt-1 divide-y divide-line">
            {ep.tasks.map((task, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5 text-[15px]">
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line" />
                {task}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {t.mine && t.status !== 'despublicada' && (
        <button className="mt-4 text-sm font-semibold text-red-600" onClick={() => run(() => actions.unpublish(id), 'Trilha tirada da loja').then(ok => ok && onClose())}>
          Tirar da loja
        </button>
      )}
    </Sheet>
  );
}

/** Publicar uma iniciativa como trilha (vai para aprovação de um administrador). */
export function PublishSheet({ initiativeId, onClose }: { initiativeId: string; onClose: () => void }) {
  const { data } = useBacklog();
  const actions = useTrilhaActions();
  const toast = useToast();
  const ini = data?.initiatives.find(i => i.id === initiativeId);
  const [f, setF] = useState({ title: ini?.title ?? '', description: ini?.description ?? '', category: 'pessoal' as TrilhaCategory, paid: false, priceXp: 50 });
  const [cover, setCover] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ini) return null;

  const publish = async () => {
    setBusy(true);
    try {
      await actions.publish(initiativeId, {
        title: f.title.trim(),
        description: f.description.trim(),
        category: f.category,
        priceXp: f.paid ? Math.max(1, Math.round(f.priceXp)) : 0,
        coverFileId: cover?.id ?? null,
      });
      toast('Trilha enviada para aprovação');
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível publicar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Publicar como trilha"
      icon={
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon n="share" />
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="accent" className="flex-1" disabled={busy || !f.title.trim() || f.description.trim().length < 10} onClick={publish}>
            Enviar para aprovação
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Os épicos e as tarefas desta iniciativa viram uma trilha na loja. Ela só aparece para todos depois que um administrador aprovar.
        </p>
        <Field label="Nome da trilha">
          <input className={inputCls} maxLength={120} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Descrição">
          <textarea rows={3} maxLength={600} className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Para quem é e o que a pessoa vai conquistar" />
        </Field>
        <Field label="Categoria">
          <select className={inputCls} value={f.category} onChange={e => setF({ ...f, category: e.target.value as TrilhaCategory })}>
            {TRILHA_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preço">
          <Seg
            items={[
              { id: 'free' as const, label: 'Grátis' },
              { id: 'paid' as const, label: 'Paga em XP' },
            ]}
            value={f.paid ? 'paid' : 'free'}
            onChange={v => setF({ ...f, paid: v === 'paid' })}
          />
        </Field>
        {f.paid && (
          <Field label="Quantos XP">
            <input type="number" min={1} step={10} className={inputCls} value={f.priceXp} onChange={e => setF({ ...f, priceXp: Number(e.target.value) })} />
          </Field>
        )}
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-line p-3 text-sm text-muted hover:border-primary/40">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt="" className="h-14 w-20 rounded-lg object-cover" />
          ) : (
            <Icon n="camera" />
          )}
          {busy ? 'Enviando…' : cover ? 'Trocar capa' : 'Capa (opcional). Sem imagem, usamos uma ilustração da área.'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              try {
                const up = await uploadImage(file, 'trilha', 1200);
                setCover({ id: up.id, url: up.url });
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Não foi possível enviar a capa.');
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
    </Sheet>
  );
}
