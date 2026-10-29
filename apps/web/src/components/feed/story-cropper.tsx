'use client';

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';

/** Story no formato do Instagram (9:16). */
const OUT_W = 1080;
const OUT_H = 1920;
const MAX_ZOOM = 4;

/**
 * Enquadrar a foto do story: a pessoa arrasta e dá zoom (com dois dedos, roda do
 * mouse ou a barrinha) dentro do quadro 9:16. Ao confirmar, recorta exatamente o
 * que ficou visível e entrega um JPEG pronto — nada é cortado sozinho.
 */
export function StoryCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Ponteiros ativos (1 = arrastar, 2 = pinça de zoom).
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{ x: number; y: number; ox: number; oy: number; dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => onCancel();
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, onCancel]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  // Escala que faz a foto cobrir o quadro no zoom 1; o zoom multiplica a partir daí.
  const base = img && frame.w ? Math.max(frame.w / img.width, frame.h / img.height) : 1;
  const scale = base * zoom;
  const rw = img ? img.width * scale : 0;
  const rh = img ? img.height * scale : 0;

  /** A foto sempre cobre o quadro inteiro (sem sobrar borda vazia). */
  const clampAt = (x: number, y: number, w: number, h: number) => ({
    x: Math.min(0, Math.max(frame.w - w, x)),
    y: Math.min(0, Math.max(frame.h - h, y)),
  });

  // Centraliza a foto ao abrir (ou ao trocar de foto); depois só mantém dentro do quadro.
  const centered = useRef(false);
  useEffect(() => {
    centered.current = false;
  }, [img]);
  useEffect(() => {
    if (!img || !frame.w) return;
    if (!centered.current) {
      centered.current = true;
      setOffset(clampAt((frame.w - rw) / 2, (frame.h - rh) / 2, rw, rh));
    } else {
      setOffset(o => clampAt(o.x, o.y, rw, rh));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rw, rh, frame.w, frame.h, img]);

  /** Muda o zoom mantendo fixo o ponto da foto que está sob (cx, cy) do quadro. */
  const zoomTo = (next: number, cx = frame.w / 2, cy = frame.h / 2) => {
    if (!img) return;
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    const sNew = base * z;
    setOffset(o => {
      const ix = (cx - o.x) / scale;
      const iy = (cy - o.y) / scale;
      return clampAt(cx - ix * sNew, cy - iy * sNew, img.width * sNew, img.height * sNew);
    });
    setZoom(z);
  };

  const rel = (e: { clientX: number; clientY: number }) => {
    const r = frameRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, rel(e));
    startGesture();
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = { x: pts[0]!.x, y: pts[0]!.y, ox: offset.x, oy: offset.y, dist: 0, zoom };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2, ox: offset.x, oy: offset.y, dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom };
    }
  };

  const onMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, rel(e));
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      const p = pts[0]!;
      setOffset(clampAt(g.ox + (p.x - g.x), g.oy + (p.y - g.y), rw, rh));
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (g.dist > 0) zoomTo((g.zoom * dist) / g.dist, g.x, g.y);
    }
  };

  const onUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    startGesture(); // recomeça com os dedos que sobraram (evita "pulo" ao soltar um)
  };

  const confirm = () => {
    if (!img) return;
    const sw = frame.w / scale;
    const sh = frame.h / scale;
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    // Não amplia além da resolução da foto (evita ficar borrado).
    const outW = Math.min(OUT_W, Math.round(sw));
    const outH = Math.round((outW * OUT_H) / OUT_W);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    canvas.toBlob(b => b && onDone(b), 'image/jpeg', 0.85);
  };

  return (
    <div className="space-y-3">
      <div
        ref={frameRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={e => {
          const p = rel(e);
          zoomTo(zoom * (e.deltaY < 0 ? 1.1 : 0.9), p.x, p.y);
        }}
        className="relative mx-auto aspect-[9/16] w-full max-w-[15rem] touch-none select-none overflow-hidden rounded-2xl bg-black"
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{ left: offset.x, top: offset.y, width: rw, height: rh }}
          />
        )}
        {!img && <span className="absolute inset-0 grid place-items-center text-sm text-white/70">Abrindo…</span>}
      </div>

      <div className="mx-auto flex max-w-[15rem] items-center gap-2">
        <Icon n="image" className="h-4 w-4 shrink-0 text-muted" />
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={e => zoomTo(Number(e.target.value))}
          aria-label="Zoom da foto"
          className="h-1.5 w-full accent-[rgb(var(--p))]"
        />
        <Icon n="image" className="h-5 w-5 shrink-0 text-muted" />
      </div>
      <p className="text-center text-xs text-muted">Arraste a foto e use o zoom para enquadrar.</p>

      <div className="flex gap-2">
        <Button variant="line" className="flex-1" onClick={onCancel}>
          Trocar foto
        </Button>
        <Button className="flex-1" disabled={!img} onClick={confirm}>
          Usar esta foto
        </Button>
      </div>
    </div>
  );
}
