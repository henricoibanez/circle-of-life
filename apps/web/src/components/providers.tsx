'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useMe } from '@/lib/me';
import { encodeThemeCookie, resolveTheme, THEME_COOKIE } from '@/lib/theme';
import { SheetProvider } from './sheet';
import { ToastProvider } from './toasts';

/** Tudo que as telas precisam por perto: cache de dados, avisos e folhas. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SheetProvider>{children}</SheetProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

/** Aplica no <html> a paleta e a aparência escolhidas no perfil. */
export function ThemeSync() {
  const { data: me } = useMe();
  useEffect(() => {
    if (!me) return;
    const prefs = me.preferences;
    const apply = () => {
      const { palette, mode } = resolveTheme({ palette: prefs.palette, randomTheme: prefs.randomTheme, themeMode: prefs.themeMode });
      const el = document.documentElement;
      el.dataset.palette = palette;
      if (mode === 'auto') delete el.dataset.theme;
      else el.dataset.theme = mode;
    };
    apply();
    document.cookie = `${THEME_COOKIE}=${encodeThemeCookie(prefs)}; path=/; max-age=31536000; samesite=lax`;
    if (!prefs.randomTheme) return;
    const t = setInterval(apply, 5000);
    return () => clearInterval(t);
  }, [me]);
  return null;
}
