'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/** Avisos rápidos que aparecem acima da barra inferior e somem sozinhos (como no protótipo). */
const ToastContext = createContext<((text: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const next = useRef(0);
  const toast = useCallback((text: string) => {
    const id = next.current++;
    setToasts(t => [...t, { id, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2"
        style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
        aria-live="polite"
      >
        {toasts.map(t => (
          <div key={t.id} className="toast rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-bg shadow-lg">
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro do ToastProvider');
  return ctx;
}
