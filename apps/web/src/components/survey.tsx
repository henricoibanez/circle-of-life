'use client';

import { GEMS, type SurveyDto } from '@circle/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Icon } from './icon';
import { inputCls } from './primitives';
import { useToast } from './toasts';
import { Button } from './ui/button';
import { ApiError } from '@/lib/api';
import { answerSurvey, NOTIF_KEY } from '@/lib/notifications';

const LABELS = ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Ótimo'];

/**
 * Pesquisa rápida: 5 estrelas que respondem na hora (no sino e na tela da pesquisa).
 * Depois da nota, um comentário opcional. Responder rende círculos uma vez.
 */
export function SurveyStars({ survey, compact }: { survey: SurveyDto; compact?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [s, setS] = useState(survey);
  const [comment, setComment] = useState(survey.answer?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(Boolean(survey.answer?.comment));

  const send = async (score: number, text?: string) => {
    setBusy(true);
    try {
      const r = await answerSurvey(s.id, score, text);
      setS(r.survey);
      if (text !== undefined) setSaved(true);
      if (r.gemsGained) toast(`Obrigado! Você ganhou ${r.gemsGained} círculos.`);
      else if (text === undefined) toast('Resposta registrada. Obrigado!');
      qc.invalidateQueries({ queryKey: NOTIF_KEY });
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível responder agora.');
    } finally {
      setBusy(false);
    }
  };

  const score = s.answer?.score ?? 0;
  return (
    <div className={compact ? 'mt-2 space-y-2' : 'space-y-3'}>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Sua nota de 1 a 5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            role="radio"
            aria-checked={score === n}
            aria-label={`${n} – ${LABELS[n - 1]}`}
            disabled={busy || !s.open}
            onClick={() => send(n)}
            className={`grid place-items-center rounded-lg transition disabled:cursor-default ${compact ? 'h-8 w-8' : 'h-11 w-11'} ${n <= score ? 'text-amber-500' : 'text-muted/60 hover:text-amber-400'}`}
          >
            <Icon n="star" className={compact ? 'h-6 w-6' : 'h-8 w-8'} fill={n <= score ? 'currentColor' : 'none'} />
          </button>
        ))}
        {score > 0 && <span className="ml-1 text-xs text-muted">{LABELS[score - 1]}</span>}
      </div>
      {!s.open && !s.answer && <p className="text-xs text-muted">Essa pesquisa já foi encerrada.</p>}
      {!s.answer && s.open && !compact && <p className="text-xs text-muted">Toque numa estrela para responder e ganhe {GEMS.pesquisa} círculos.</p>}
      {s.answer && s.open && (
        <div className="space-y-2">
          <textarea
            rows={compact ? 2 : 3}
            maxLength={1000}
            className={inputCls}
            placeholder="Quer contar mais? (opcional)"
            value={comment}
            onChange={e => {
              setComment(e.target.value);
              setSaved(false);
            }}
          />
          <div className="flex items-center gap-2">
            <Button variant="soft" className="px-3 py-1.5 text-sm" disabled={busy || saved || !comment.trim()} onClick={() => send(score, comment)}>
              {saved ? (
                <>
                  <Icon n="check" className="h-4 w-4" /> Enviado
                </>
              ) : (
                'Enviar comentário'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
