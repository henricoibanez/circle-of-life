import type { NextConfig } from 'next';

// Endereço da API. O navegador só conversa com o site; o site repassa
// todo pedido para /api/* a este endereço (assim o cookie de login
// funciona igual no computador local e na produção).
const apiUrl = process.env.API_INTERNAL_URL;
if (!apiUrl) {
  throw new Error('Falta a variável API_INTERNAL_URL (endereço da API). Confira o arquivo .env.');
}

const nextConfig: NextConfig = {
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
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl.replace(/\/$/, '')}/api/:path*` }];
  },
};

export default nextConfig;
