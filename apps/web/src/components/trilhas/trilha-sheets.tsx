'use client';

import { AREA, type AreaId, TRILHA_CATEGORIES, type TrilhaCategory, type TrilhaDetailDto, type TrilhaDto } from '@circle/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Art } from '@/components/art';
import { AreaPicker } from '@/components/backlog/forms';
import { Icon } from '@/components/icon';
import { AreaIcon, Field, IconBtn, inputCls, Seg, Tag, ImageHint } from '@/components/primitives';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useBacklog } from '@/lib/backlog';
import { useMe } from '@/lib/me';
import { useGroups } from '@/lib/social';
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
        <p className="absolute inset-0 grid place-items-center whitespace-pre-line text-center font-serif text-[1.0625rem] leading-tight tracking-wide text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
          {t.coverText}
        </p>
      )}
    </div>
  );
}

export const priceLabel = (t: Pick<TrilhaDto, 'priceXp'>) => (t.priceXp ? `${t.priceXp.toLocaleString('pt-BR')} XP` : 'Grátis');

/** Selo do status. No grupo, "pendente" é a sugestão esperando um gestor. */
export function statusTag(t: Pick<TrilhaDto, 'status' | 'mine' | 'groupId'>): [string, string] | null {
  if (t.status === 'pendente') return [t.mine ? 'Em análise' : t.groupId ? 'Sugestão' : 'Aguardando aprovação', '#d97706'];
  if (t.status === 'recusada') return ['Recusada', '#dc2626'];
  if (t.status === 'despublicada') return [t.groupId ? 'Fora do grupo' : 'Fora da loja', '#6b7280'];
  return null;
}

const run = async (toast: (m: string) => void, setBusy: (b: boolean) => void, fn: () => Promise<unknown>, ok?: string) => {
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

/**
 * Detalhe da trilha (um épico com as tarefas): importar ou comprar escolhendo a iniciativa;
 * aprovar ou recusar (admin do app na loja, gestor no grupo); editar (gestor, trilha do grupo).
 */
export function TrilhaSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: t } = useTrilha(id);
  const { data: me } = useMe();
  const actions = useTrilhaActions();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  if (!t || !me) return null;
  if (editing) return <TrilhaEditSheet t={t} onClose={() => setEditing(false)} />;

  const go = (fn: () => Promise<unknown>, ok?: string) => run(toast, setBusy, fn, ok);
  const needsPayment = t.priceXp > 0 && !t.acquired && !t.mine;
  const status = statusTag(t);

  let footer;
  if (t.status === 'aprovada' && !importing) {
    footer = (
      <Button variant="accent" className="flex-1" onClick={() => setImporting(true)}>
        {needsPayment ? `Comprar por ${priceLabel(t)}` : t.acquired ? 'Importar novamente' : 'Importar para o backlog'}
      </Button>
    );
  }

  if (importing) return <ImportStep t={t} needsPayment={needsPayment} onBack={() => setImporting(false)} onDone={onClose} />;

  const removeLabel = t.groupId ? (t.status === 'aprovada' ? 'Tirar do grupo' : 'Retirar sugestão') : 'Tirar da loja';
  const canRemove = t.status !== 'despublicada' && (t.mine || t.canEdit);

  return (
    <Sheet title={t.title} onClose={onClose} footer={footer}>
      <Cover t={t} className="mb-3 aspect-[16/9] w-full overflow-hidden rounded-2xl" />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {t.groupId ? <Tag c="#7c4dde">Trilha do grupo</Tag> : <Tag c={t.priceXp ? '#7c4dde' : '#16a34a'}>{priceLabel(t)}</Tag>}
        {status && <Tag c={status[1]}>{status[0]}</Tag>}
        <span className="text-xs text-muted">por {t.author ? `${t.author.name} (@${t.author.handle})` : 'Circle of Life'}</span>
      </div>
      {t.group && <p className="mb-2 text-xs text-muted">Só os membros de {t.group.name} veem e baixam esta trilha.</p>}
      <p className="text-[0.9375rem] text-ink/80">{t.description}</p>
      {t.rejectionReason && t.status === 'recusada' && <p className="mt-3 rounded-xl bg-red-500/5 px-3 py-2 text-sm text-red-700">Motivo da recusa: {t.rejectionReason}</p>}
      <div className="mt-4 flex items-center gap-2">
        <AreaIcon id={t.area} size="w-7 h-7" icon="w-4 h-4" />
        <p className="flex-1 font-semibold">{t.title}</p>
        <Tag c="#7c4dde">Épico</Tag>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {t.areas.map(a => AREA[a].name).join(', ')} • {t.tasks.length === 1 ? '1 tarefa' : `${t.tasks.length} tarefas`}
      </p>
      <ul className="mt-1 divide-y divide-line">
        {t.tasks.map((task, i) => (
          <li key={i} className="flex items-center gap-3 py-2.5 text-[0.9375rem]">
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line" />
            {task}
          </li>
        ))}
      </ul>
      {/* Revisão (admin na loja, gestor no grupo): no fim, depois de conferir as tarefas. */}
      {t.canReview && (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-2 text-sm font-semibold text-amber-700">{rejecting ? 'Por que recusar?' : 'Confira as tarefas e decida'}</p>
          {rejecting && (
            <textarea
              rows={3}
              maxLength={500}
              className={inputCls + ' mb-2'}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Motivo (opcional, o autor vai ver). Ex.: Detalhe melhor as tarefas da segunda semana."
              autoFocus
            />
          )}
          <div className="flex gap-2">
            {rejecting ? (
              <>
                <Button variant="line" className="flex-1" onClick={() => setRejecting(false)}>
                  Voltar
                </Button>
                <Button className="flex-1 !bg-red-600 !text-white" disabled={busy} onClick={() => go(() => actions.reject(id, reason), 'Trilha recusada').then(ok => ok && onClose())}>
                  Recusar trilha
                </Button>
              </>
            ) : (
              <>
                <Button variant="line" className="flex-1 !text-red-600" disabled={busy} onClick={() => setRejecting(true)}>
                  <Icon n="xCircle" className="h-4 w-4" />
                  Recusar
                </Button>
                <Button className="flex-1" disabled={busy} onClick={() => go(() => actions.approve(id), t.groupId ? 'Trilha aprovada e liberada no grupo' : 'Trilha aprovada e publicada na loja')}>
                  <Icon n="checkCircle" className="h-4 w-4" />
                  Aprovar
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-4">
        {t.canEdit && (
          <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent" onClick={() => setEditing(true)}>
            <Icon n="edit" className="h-4 w-4" />
            Editar trilha
          </button>
        )}
        {canRemove && (
          <button className="text-sm font-semibold text-red-600" onClick={() => go(() => actions.unpublish(id), 'Pronto. Quem já importou continua com o épico.').then(ok => ok && onClose())}>
            {removeLabel}
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** Importar: escolher a iniciativa (ou criar uma nova) e, se for paga, confirmar a compra. */
function ImportStep({ t, needsPayment, onBack, onDone }: { t: TrilhaDetailDto; needsPayment: boolean; onBack: () => void; onDone: () => void }) {
  const { data } = useBacklog();
  const { data: me } = useMe();
  const actions = useTrilhaActions();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const inis = (data?.initiatives ?? []).filter(i => !i.completedAt);
  const [target, setTarget] = useState<string>('new');
  const [name, setName] = useState(t.title);
  if (!me) return null;

  const short = needsPayment && me.xp.disponivel < t.priceXp;
  const ok = !short && (target !== 'new' || name.trim().length > 0);
  const doImport = () =>
    run(toast, setBusy, async () => {
      const r = await actions.import(t.id, target === 'new' ? { newInitiative: name.trim() } : { initiativeId: target });
      onDone();
      toast(r.paid ? `Trilha comprada por ${r.paid} XP e importada para o backlog` : 'Épico importado para o backlog');
      router.push('/backlog');
    });

  return (
    <Sheet
      title="Importar para o backlog"
      onClose={onBack}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onBack}>
            Voltar
          </Button>
          <Button variant="accent" className="flex-1" disabled={busy || !ok} onClick={doImport}>
            {needsPayment ? `Comprar por ${priceLabel(t)}` : 'Importar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          O épico <b className="text-ink">“{t.title}”</b> e as {t.tasks.length} tarefas dele vão para o seu backlog. Escolha em qual iniciativa ele entra.
        </p>
        <Field label="Iniciativa">
          <select className={inputCls} value={target} onChange={e => setTarget(e.target.value)}>
            <option value="new">+ Nova iniciativa</option>
            {inis.map(i => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </Field>
        {target === 'new' && (
          <Field label="Nome da nova iniciativa">
            <input className={inputCls} maxLength={200} value={name} onChange={e => setName(e.target.value)} />
          </Field>
        )}
        {needsPayment && (
          <p className="rounded-xl bg-accent/5 px-3 py-2 text-sm">
            Você tem <strong>{me.xp.disponivel.toLocaleString('pt-BR')} XP disponíveis</strong>.{' '}
            {short ? 'Não é suficiente para esta trilha.' : `Depois da compra ficam ${(me.xp.disponivel - t.priceXp).toLocaleString('pt-BR')} XP. Seu XP total não muda.`}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** Gestor edita a trilha do grupo: nome, descrição, área e tarefas. Quem já importou não muda. */
function TrilhaEditSheet({ t, onClose }: { t: TrilhaDetailDto; onClose: () => void }) {
  const actions = useTrilhaActions();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: t.title, description: t.description, areas: t.areas as AreaId[] });
  const [tasks, setTasks] = useState(t.tasks);
  const clean = tasks.map(x => x.trim()).filter(Boolean);
  const save = () =>
    run(toast, setBusy, () => actions.edit(t.id, { ...f, title: f.title.trim(), description: f.description.trim(), tasks: clean }), 'Trilha atualizada').then(ok => ok && onClose());

  return (
    <Sheet
      title="Editar trilha do grupo"
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="accent" className="flex-1" disabled={busy || !f.title.trim() || !clean.length} onClick={save}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">As mudanças valem para quem importar daqui para a frente. Quem já importou continua com a versão que baixou.</p>
        <Field label="Nome">
          <input className={inputCls} maxLength={120} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Descrição">
          <textarea rows={3} maxLength={600} className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Áreas da vida">
          <AreaPicker multi value={f.areas} onChange={areas => setF({ ...f, areas })} />
        </Field>
        <Field label="Tarefas">
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inputCls} maxLength={200} value={task} placeholder="Nova tarefa" onChange={e => setTasks(tasks.map((x, j) => (j === i ? e.target.value : x)))} />
                <IconBtn n="x" label="Remover tarefa" onClick={() => setTasks(tasks.filter((_, j) => j !== i))} />
              </div>
            ))}
            <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent" onClick={() => setTasks([...tasks, ''])}>
              <Icon n="plus" className="h-4 w-4" />
              Adicionar tarefa
            </button>
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

/**
 * Publicar um épico como trilha: na loja (aprovação de um administrador) ou num grupo
 * (gestor publica direto; membro envia como sugestão para os gestores).
 * Sem `epicId`, a pessoa escolhe o épico (usado na tela do grupo).
 */
export function PublishSheet({ epicId, groupId, onClose }: { epicId?: string; groupId?: string; onClose: () => void }) {
  const { data } = useBacklog();
  const { data: groups } = useGroups();
  const actions = useTrilhaActions();
  const toast = useToast();
  const epics = (data?.epics ?? []).filter(e => data?.tasks.some(t => t.epicId === e.id));
  const [eid, setEid] = useState(epicId ?? '');
  const epic = data?.epics.find(e => e.id === eid);
  const [dest, setDest] = useState(groupId ?? 'loja');
  const [f, setF] = useState({ title: epic?.title ?? '', description: epic?.description ?? '', category: 'pessoal' as TrilhaCategory, paid: false, priceXp: 50 });
  const [cover, setCover] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  if (epicId && !epic) return null;

  const group = dest === 'loja' ? null : groups?.mine.find(g => g.id === dest);
  const gestor = Boolean(group?.admin);
  const pick = (id: string) => {
    const e = data.epics.find(x => x.id === id);
    setEid(id);
    if (e) setF({ ...f, title: e.title, description: f.description || e.description });
  };

  const publish = () =>
    run(toast, setBusy, async () => {
      await actions.publish(eid, {
        title: f.title.trim(),
        description: f.description.trim(),
        category: f.category,
        priceXp: group ? 0 : f.paid ? Math.max(1, Math.round(f.priceXp)) : 0,
        coverFileId: cover?.id ?? null,
        groupId: group?.id ?? null,
      });
      toast(!group ? 'Trilha enviada para aprovação' : gestor ? `Trilha publicada em ${group.name}` : 'Sugestão enviada aos gestores do grupo');
      onClose();
    });

  const button = !group ? 'Enviar para aprovação' : gestor ? 'Publicar no grupo' : 'Enviar sugestão';
  const hint = !group
    ? 'O épico e as tarefas dele viram uma trilha na loja. Ela só aparece para todos depois que um administrador aprovar.'
    : gestor
      ? `Você é gestor de ${group.name}: a trilha já entra no grupo, só para os membros.`
      : `A trilha vai como sugestão: os gestores de ${group.name} aprovam ou recusam.`;

  return (
    <Sheet
      title={groupId ? (gestor ? 'Nova trilha do grupo' : 'Sugerir trilha') : 'Publicar como trilha'}
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
          <Button variant="accent" className="flex-1" disabled={busy || !eid || !f.title.trim() || f.description.trim().length < 10} onClick={publish}>
            {button}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!epicId && (
          <Field label="Épico">
            <select className={inputCls} value={eid} onChange={e => pick(e.target.value)}>
              <option value="">Escolha um épico seu</option>
              {epics.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            {!epics.length && <p className="mt-1 text-xs text-muted">Crie um épico com tarefas no backlog para poder publicar.</p>}
          </Field>
        )}
        {!groupId && (
          <Field label="Onde publicar">
            <select className={inputCls} value={dest} onChange={e => setDest(e.target.value)}>
              <option value="loja">Loja de trilhas (todo mundo)</option>
              {(groups?.mine ?? []).map(g => (
                <option key={g.id} value={g.id}>
                  Grupo: {g.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <p className="text-sm text-muted">{hint}</p>
        <Field label="Nome da trilha">
          <input className={inputCls} maxLength={120} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Descrição">
          <textarea rows={3} maxLength={600} className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Para quem é e o que a pessoa vai conquistar" />
          {/* O botão só liga com 10+ letras na descrição: dizer quanto falta, para ninguém ficar sem saber por quê. */}
          {f.description.trim().length < 10 && <p className="mt-1 text-xs text-amber-700">Escreva pelo menos 10 letras para enviar (faltam {10 - f.description.trim().length}).</p>}
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
        {!group && (
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
        )}
        {!group && f.paid && (
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
        <ImageHint purpose="trilha" />
      </div>
    </Sheet>
  );
}
