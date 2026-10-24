'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Quill } from '@/components/art';
import { useBacklogSheets } from '@/components/backlog/use-backlog-sheets';
import { Header, InfoSheet } from '@/components/header';
import { Icon, type IconName } from '@/components/icon';
import { Card } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { since } from '@/lib/time';

type Necro = { html: string; updatedAt: string | null };
const KEY = ['necrologio'];

/**
 * Necrológio: um campo de texto em branco com a barra de formatação do
 * protótipo e salvamento automático. Sem seções nesta versão.
 */
export default function NecrologioPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const sheets = useBacklogSheets();
  const { openSheet, openActions } = useSheets();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => api<Necro>('/necrologio') });
  const ed = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const loaded = useRef(false);
  const [saved, setSaved] = useState(true);
  const [block, setBlock] = useState('p');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Coloca o texto salvo no editor uma única vez (depois o editor é a fonte).
  useEffect(() => {
    if (data && ed.current && !loaded.current) {
      ed.current.innerHTML = data.html;
      setUpdatedAt(data.updatedAt);
      loaded.current = true;
    }
  }, [data]);

  const save = async () => {
    clearTimeout(timer.current);
    const html = ed.current?.innerHTML ?? '';
    try {
      const r = await api<Necro>('/necrologio', { method: 'PUT', body: { html } });
      qc.setQueryData(KEY, r);
      setUpdatedAt(r.updatedAt);
      setSaved(true);
    } catch {
      toast('Não foi possível salvar. Vamos tentar de novo quando você continuar escrevendo.');
    }
  };
  // Salva ao sair da tela, se ficou algo pendente.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        const html = ed.current?.innerHTML;
        if (html !== undefined) api('/necrologio', { method: 'PUT', body: { html } }).catch(() => undefined);
      }
    },
    [],
  );

  const onInput = () => {
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  };
  const cmd = (c: string, v?: string) => {
    ed.current?.focus();
    document.execCommand(c, false, v);
    onInput();
  };
  const sync = () => {
    const b = String(document.queryCommandValue('formatBlock')).toLowerCase();
    setBlock(['h1', 'h2'].includes(b) ? b : 'p');
  };

  const TB = ({ n, c, v, label }: { n: IconName; c: string; v?: string; label: string }) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={e => e.preventDefault()}
      onClick={() => cmd(c, v)}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-sunk"
    >
      <Icon n={n} className="h-[18px] w-[18px]" sw={2} />
    </button>
  );

  const words = (ed.current?.innerText ?? '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <>
      <Header
        title="Necrológio"
        sub="Escreva sobre o legado que deseja deixar."
        right={
          <span title={saved ? 'Salvo' : 'Salvando'} className={`grid h-11 w-11 place-items-center ${saved ? 'text-primary' : 'text-muted'}`}>
            <Icon n="cloud" className="h-6 w-6" />
          </span>
        }
      />
      <div className="space-y-4 px-4 pb-8">
        <div className="relative flex items-center gap-5 overflow-hidden rounded-3xl border border-accent/10 bg-accent/[.07] p-5">
          <div className="relative z-[1] min-w-0 flex-1 pr-20">
            <p className="text-[17px] font-semibold">Escreva como um amigo contaria a sua vida</p>
            <p className="mt-1 text-sm text-muted">Imagine que você viveu tudo o que deveria. Mire alto e seja sincero.</p>
            <Button variant="aline" className="mt-3 rounded-full bg-surface/70 px-3 py-1.5" asChild>
              <Link href="/analise">
                <Icon n="chart" className="h-4 w-4" />
                Ver insights
              </Link>
            </Button>
          </div>
          <Quill className="absolute -right-2 bottom-0 w-28 opacity-90" />
        </div>

        <Card className="overflow-hidden">
          <div className="no-bar flex items-center gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5">
            <TB n="undo" c="undo" label="Desfazer" />
            <TB n="redo" c="redo" label="Refazer" />
            <span className="mx-1 h-6 w-px shrink-0 bg-line" />
            <select
              aria-label="Estilo do texto"
              value={block}
              onChange={e => {
                setBlock(e.target.value);
                cmd('formatBlock', e.target.value);
              }}
              className="rounded-lg bg-transparent px-1 py-1.5 text-sm font-semibold hover:bg-sunk focus:outline-none"
            >
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="p">Texto</option>
            </select>
            <span className="mx-1 h-6 w-px shrink-0 bg-line" />
            <TB n="bold" c="bold" label="Negrito" />
            <TB n="italic" c="italic" label="Itálico" />
            <TB n="underline" c="underline" label="Sublinhado" />
            <TB n="textColor" c="foreColor" v="#7c4dde" label="Destacar em roxo" />
            <TB n="ul" c="insertUnorderedList" label="Lista" />
            <TB n="align" c="justifyCenter" label="Centralizar" />
            <button
              aria-label="Mais opções"
              onMouseDown={e => e.preventDefault()}
              onClick={() =>
                openActions('Necrológio', [
                  { icon: 'align', label: 'Alinhar à esquerda', run: () => cmd('justifyLeft') },
                  { icon: 'x', label: 'Limpar formatação da seleção', run: () => cmd('removeFormat') },
                  {
                    icon: 'copy',
                    label: 'Copiar texto',
                    run: () => navigator.clipboard?.writeText(ed.current?.innerText ?? '').then(() => toast('Texto copiado'), () => undefined),
                  },
                  { icon: 'info', label: 'Como fazer o exercício', run: () => openSheet(close => <InfoSheet k="necro" onClose={close} />) },
                ])
              }
              className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-sunk"
            >
              <Icon n="more" sw={2.6} />
            </button>
          </div>
          <div
            ref={ed}
            contentEditable={Boolean(data)}
            suppressContentEditableWarning
            onInput={onInput}
            onKeyUp={sync}
            onMouseUp={sync}
            onBlur={() => !saved && save()}
            data-ph="Comece escrevendo como um amigo descreveria a sua vida…"
            className="doc min-h-[360px] px-5 py-5 text-[15px] focus:outline-none"
            aria-label="Texto do necrológio"
            role="textbox"
            aria-multiline="true"
          />
          <p className="px-5 pb-4 text-right text-xs text-muted">
            {words > 0 && `${words} ${words === 1 ? 'palavra' : 'palavras'} · `}
            Última edição: {updatedAt ? since(updatedAt).replace('agora', 'agora há pouco') : 'ainda não editado'}
          </p>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <p className="flex-1 text-sm">Escrever fez você pensar em algo para fazer?</p>
          <Button variant="soft" className="px-3 py-2" onClick={() => sheets.openInitiative()}>
            Criar iniciativa
          </Button>
        </Card>
      </div>
    </>
  );
}
