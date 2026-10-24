import type { ArtVariant } from './areas';

export const PALETTE_IDS = ['natureza', 'serenity', 'soft', 'dourado', 'mindful', 'premium'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export type ThemeMode = 'auto' | 'light' | 'dark';

/** As 6 paletas do protótipo. "Preto/Premium" força o modo escuro. */
export const PALETTES: { id: PaletteId; name: string; sub: string; art: ArtVariant; c: string }[] = [
  { id: 'natureza', name: 'Verde', sub: 'Natureza', art: 'lake', c: '#5e873c' },
  { id: 'serenity', name: 'Azul', sub: 'Serenity', art: 'lake', c: '#346ab8' },
  { id: 'soft', name: 'Vermelho', sub: 'Soft', art: 'sun', c: '#c85858' },
  { id: 'dourado', name: 'Amarelo', sub: 'Dourado', art: 'sun', c: '#ba8418' },
  { id: 'mindful', name: 'Roxo', sub: 'Mindfulness', art: 'night', c: '#7c4dde' },
  { id: 'premium', name: 'Preto', sub: 'Premium', art: 'night', c: '#1e1e1e' },
];

/** No modo aleatório, a paleta muda a cada 2 minutos (igual para todo mundo no mesmo instante). */
export const RANDOM_PALETTE_MS = 120_000;
export const randomPalette = (now = Date.now()): PaletteId => PALETTES[Math.floor(now / RANDOM_PALETTE_MS) % PALETTES.length]!.id;
