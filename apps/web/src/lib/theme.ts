import { randomPalette, type PaletteId, type ThemeMode } from '@circle/shared';

/**
 * Cookie (não secreto) com o último tema usado. Permite que o servidor já
 * desenhe a página com as cores certas, sem "piscar" no tema padrão.
 */
export const THEME_COOKIE = 'col_theme';

export type ThemePrefs = { palette: PaletteId; randomTheme: boolean; themeMode: ThemeMode };

/** Paleta e modo efetivos agora (o modo aleatório troca a cada 2 minutos; Premium força o escuro). */
export function resolveTheme(p: ThemePrefs, now = Date.now()) {
  const palette = p.randomTheme ? randomPalette(now) : p.palette;
  const mode: ThemeMode = palette === 'premium' ? 'dark' : p.themeMode;
  return { palette, mode };
}

export const encodeThemeCookie = (p: ThemePrefs) => `${p.palette}.${p.randomTheme ? 1 : 0}.${p.themeMode}`;

export function decodeThemeCookie(raw?: string): ThemePrefs | null {
  const [palette, random, mode] = (raw ?? '').split('.');
  if (!palette || !mode) return null;
  return { palette: palette as PaletteId, randomTheme: random === '1', themeMode: mode as ThemeMode };
}
