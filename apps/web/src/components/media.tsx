'use client';

import type { VideoClip } from '@circle/shared';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';

/** Segundos em "m:ss" (ex.: 75 → "1:15"). */
export const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Vídeo que toca só o trecho escolhido (clip). Sem clip, toca o vídeo todo.
 * Com `autoPlay`, tenta tocar com som; se o navegador não deixar, toca sem som.
 */
export function ClipVideo({
  src,
  clip,
  className = '',
  autoPlay,
  loop,
  muted: mutedProp,
  paused,
  controls,
  onProgress,
  onEnded,
}: {
  src: string;
  clip?: VideoClip | null;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** Pausa por fora (ex.: segurar o dedo no story). */
  paused?: boolean;
  controls?: boolean;
  /** Andamento do trecho, de 0 a 1. */
  onProgress?: (p: number) => void;
  onEnded?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [mutedAuto, setMutedAuto] = useState(false);
  const start = clip?.start ?? 0;
  const end = clip?.end;

  const play = () => {
    const v = ref.current;
    if (!v) return;
    v.play().catch(() => {
      // Navegador bloqueou o som sem toque da pessoa: toca sem som.
      v.muted = true;
      setMutedAuto(true);
      void v.play().catch(() => undefined);
    });
  };

  // Trocou o trecho (ex.: a pessoa mexeu na barra): volta para o início dele.
  useEffect(() => {
    const v = ref.current;
    if (v && v.readyState >= 1) v.currentTime = start;
  }, [start, end]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !autoPlay) return;
    if (paused) v.pause();
    else if (v.readyState >= 1) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      playsInline
      preload="metadata"
      muted={mutedProp ?? mutedAuto}
      controls={controls}
      onLoadedMetadata={e => {
        e.currentTarget.currentTime = start;
        if (autoPlay && !paused) play();
      }}
      onTimeUpdate={e => {
        const v = e.currentTarget;
        const stop = end ?? v.duration;
        if (Number.isFinite(stop) && stop > start) onProgress?.(Math.min(1, Math.max(0, (v.currentTime - start) / (stop - start))));
        if (end != null && v.currentTime >= end) {
          if (loop) v.currentTime = start;
          else {
            v.pause();
            onEnded?.();
          }
        }
        // Voltou para antes do trecho (ex.: pelos controles): leva para o início dele.
        if (v.currentTime < start - 0.3) v.currentTime = start;
      }}
      onEnded={e => {
        if (loop) {
          e.currentTarget.currentTime = start;
          void e.currentTarget.play().catch(() => undefined);
        } else onEnded?.();
      }}
    />
  );
}

/**
 * Escolher o trecho do vídeo que aparece: prévia em loop e uma barra para o início.
 * O trecho dura `max` segundos (ou o vídeo todo, se for mais curto).
 */
export function ClipPicker({
  src,
  duration,
  max,
  value,
  onChange,
  frameClassName = '',
  overlay,
}: {
  src: string;
  duration: number;
  max: number;
  value: VideoClip;
  onChange: (c: VideoClip) => void;
  /** Formato da prévia (ex.: vertical no story). */
  frameClassName?: string;
  /** Algo por cima da prévia (ex.: marca d'água das áreas). */
  overlay?: React.ReactNode;
}) {
  const len = Math.min(max, duration);
  const free = Math.max(0, duration - len);
  return (
    <div className="space-y-2">
      <div className={`relative overflow-hidden rounded-2xl bg-black ${frameClassName}`}>
        <ClipVideo src={src} clip={value} muted autoPlay loop className="h-full w-full object-cover" />
        {overlay}
      </div>
      {free > 0.2 ? (
        <div className="px-1">
          <label className="block text-xs text-muted" htmlFor="clip-start">
            Arraste para escolher o trecho de {Math.round(len)} s que aparece
          </label>
          <input
            id="clip-start"
            type="range"
            min={0}
            max={free}
            step={0.1}
            value={value.start}
            onChange={e => {
              const start = Number(e.target.value);
              onChange({ start, end: Math.min(duration, start + len) });
            }}
            className="w-full accent-[rgb(var(--p))]"
          />
          <p className="text-center text-xs tabular-nums text-muted">
            Trecho: <span className="font-semibold text-ink/80">{fmtSec(value.start)} a {fmtSec(value.end)}</span> de {fmtSec(duration)}
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-muted">O vídeo inteiro aparece ({fmtSec(duration)}).</p>
      )}
    </div>
  );
}

/**
 * Vídeo no feed, como no Instagram: toca sozinho e sem som quando aparece na tela,
 * pausa ao sair dela; um toque liga ou desliga o som.
 */
export function FeedVideo({ src, clip, className = '' }: { src: string; clip?: VideoClip | null; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting && e.intersectionRatio >= 0.6)), { threshold: [0, 0.6] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className={`relative overflow-hidden rounded-xl bg-black ${className}`}>
      <ClipVideo src={src} clip={clip} autoPlay loop muted={muted} paused={!visible} className="max-h-[40rem] w-full object-contain" />
      <button
        type="button"
        onClick={() => setMuted(m => !m)}
        aria-label={muted ? 'Ligar o som' : 'Desligar o som'}
        className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white"
      >
        {muted ? 'Som desligado' : 'Som ligado'}
      </button>
    </div>
  );
}

/** Barra de envio de um arquivo grande (vídeo), com a porcentagem. */
export function UploadBar({ pct, label = 'Enviando vídeo' }: { pct: number; label?: string }) {
  return (
    <div className="space-y-1" role="status">
      <p className="flex justify-between text-xs text-muted">
        <span>{label}…</span>
        <span className="tabular-nums">{Math.round(pct * 100)}%</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunk">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
    </div>
  );
}

/** Cartão de documento (PDF, Word…): ícone com a extensão e o nome; abre em nova aba. */
export function DocCard({ name, url, className = '' }: { name: string; url: string; className?: string }) {
  const ext = (name.split('.').pop() ?? '').toUpperCase().slice(0, 4);
  return (
    <a href={url} target="_blank" rel="noreferrer" title={name} className={`flex flex-col items-center justify-center gap-1 p-2 text-center ${className}`}>
      <span className="relative text-primary">
        <Icon n="book" className="h-7 w-7" />
      </span>
      <span className="rounded bg-primary/10 px-1.5 text-[0.625rem] font-bold text-primary">{ext || 'ARQ'}</span>
      <span className="line-clamp-2 w-full text-[0.6875rem] leading-tight text-ink/80 [overflow-wrap:anywhere]">{name}</span>
    </a>
  );
}
