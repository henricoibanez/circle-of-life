'use client';

import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';

const HOLD_MS = 320; // segurar este tempo para começar a arrastar (toque curto continua sendo toque)
const MOVE_CANCEL = 10; // se mexer mais que isto antes de começar, é rolagem: cancela

/**
 * Lista com "segurar e arrastar" para reordenar (igual ao Board), sem biblioteca.
 * Um toque curto continua funcionando normal (abrir, expandir…); segurar inicia o arrastar.
 */
export function Reorderable<T extends { id: string }>({
  items,
  enabled,
  onReorder,
  className = '',
  children,
}: {
  items: T[];
  enabled: boolean;
  onReorder: (ids: string[]) => void;
  className?: string;
  children: (item: T, dragging: boolean) => ReactNode;
}) {
  const [order, setOrder] = useState(items.map(i => i.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLDivElement | null>());
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPt = useRef<{ x: number; y: number } | null>(null);

  // Enquanto não está arrastando, acompanha a lista que vem de fora.
  useEffect(() => {
    if (!dragId) setOrder(items.map(i => i.id));
  }, [items, dragId]);

  // Durante o arraste, trava a rolagem da página (no toque).
  useEffect(() => {
    if (!dragId) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    window.addEventListener('touchmove', stop, { passive: false });
    return () => window.removeEventListener('touchmove', stop);
  }, [dragId]);

  const byId = new Map(items.map(i => [i.id, i]));
  const ordered = order.map(id => byId.get(id)).filter((x): x is T => Boolean(x));
  const clearHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };

  const onPointerDown = (e: ReactPointerEvent, id: string) => {
    if (!enabled || e.button !== 0) return;
    startPt.current = { x: e.clientX, y: e.clientY };
    const pid = e.pointerId;
    const el = e.currentTarget as HTMLElement;
    hold.current = setTimeout(() => {
      el.setPointerCapture?.(pid);
      setDragId(id);
    }, HOLD_MS);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragId) {
      if (hold.current && startPt.current && Math.hypot(e.clientX - startPt.current.x, e.clientY - startPt.current.y) > MOVE_CANCEL) clearHold();
      return;
    }
    e.preventDefault();
    const y = e.clientY;
    const over = order.find(x => {
      const r = refs.current.get(x)?.getBoundingClientRect();
      return r && y >= r.top && y <= r.bottom;
    });
    if (over && over !== dragId) {
      const next = [...order];
      next.splice(next.indexOf(dragId), 1);
      next.splice(next.indexOf(over), 0, dragId);
      setOrder(next);
    }
  };

  const onPointerUp = () => {
    clearHold();
    if (!dragId) return;
    const changed = order.join() !== items.map(i => i.id).join();
    setDragId(null);
    if (changed) onReorder(order);
  };

  return (
    <div className={className}>
      {ordered.map(item => {
        const dragging = item.id === dragId;
        return (
          <div
            key={item.id}
            ref={el => {
              refs.current.set(item.id, el);
            }}
            onPointerDown={enabled ? e => onPointerDown(e, item.id) : undefined}
            onPointerMove={enabled ? onPointerMove : undefined}
            onPointerUp={enabled ? onPointerUp : undefined}
            onPointerCancel={enabled ? onPointerUp : undefined}
            className={dragging ? 'relative z-10 scale-[1.02] opacity-90 transition-transform' : 'transition-transform'}
            style={dragging ? { touchAction: 'none', boxShadow: '0 10px 30px rgba(0,0,0,.18)' } : undefined}
          >
            {children(item, dragging)}
          </div>
        );
      })}
    </div>
  );
}
