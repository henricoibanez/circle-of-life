import type { NextConfig } from 'next';

// Endereço da API. O navegador só conversa com o site; o site repassa
// todo pedido para /api/* a este endereço (assim o cookie de login
// funciona igual no computador local e na produção).
const apiUrl = process.env.API_INTERNAL_URL;
if (!apiUrl) {
  throw new Error('Falta a variável API_INTERNAL_URL (endereço da API). Confira o arquivo .env.');
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl.replace(/\/$/, '')}/api/:path*` }];
  },
};

export default nextConfig;
