import type { MetadataRoute } from 'next';

/** Manifesto do app: permite "instalar" o Circle of Life na tela inicial do celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Circle of Life',
    short_name: 'Circle of Life',
    description: 'Sprint da Vida: planeje e execute a sua vida em sprints.',
    lang: 'pt-BR',
    start_url: '/feed',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafaf7',
    theme_color: '#fafaf7',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
