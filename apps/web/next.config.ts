import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Endereço da API. O navegador só conversa com o site; o site repassa
// todo pedido para /api/* a este endereço (assim o cookie de login
// funciona igual no computador local e na produção).
const apiUrl = process.env.API_INTERNAL_URL;
if (!apiUrl) {
  throw new Error('Falta a variável API_INTERNAL_URL (endereço da API). Confira o arquivo .env.');
}

const nextConfig: NextConfig = {
  // Na imagem Docker (apps/web/Dockerfile), gera um servidor enxuto com só o necessário.
  // Na Vercel e no computador local, nada muda.
  ...(process.env.NEXT_OUTPUT === 'standalone' && {
    output: 'standalone',
    outputFileTracingRoot: resolve(__dirname, '../..'),
  }),
  // O selo "N" do Next em desenvolvimento cobre a barra inferior do app.
  devIndicators: false,
  poweredByHeader: false,
  // Cabeçalhos de segurança básicos em todas as páginas.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  // Endereço que mudou: com MOVED_TO_URL preenchida (só no servidor antigo), toda página
  // manda a pessoa para o mesmo caminho no endereço novo. Vazia = nada muda.
  async redirects() {
    const movedTo = process.env.MOVED_TO_URL?.replace(/\/$/, '');
    return movedTo ? [{ source: '/:path*', destination: `${movedTo}/:path*`, permanent: true }] : [];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl.replace(/\/$/, '')}/api/:path*` }];
  },
};

export default nextConfig;
