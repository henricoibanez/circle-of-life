import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Providers } from '@/components/providers';
import { decodeThemeCookie, resolveTheme, THEME_COOKIE } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Circle of Life',
  description: 'Sprint da Vida: planeje e execute a sua vida em sprints.',
  applicationName: 'Circle of Life',
  appleWebApp: { capable: true, title: 'Circle of Life', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#10120f' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Já desenha a página com o último tema usado (sem "piscar" nas cores padrão).
  const prefs = decodeThemeCookie((await cookies()).get(THEME_COOKIE)?.value);
  const theme = prefs ? resolveTheme(prefs) : { palette: 'natureza', mode: 'auto' };
  return (
    <html lang="pt-BR" data-palette={theme.palette} data-theme={theme.mode === 'auto' ? undefined : theme.mode} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
