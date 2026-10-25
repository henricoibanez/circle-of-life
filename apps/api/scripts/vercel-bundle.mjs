// Junta a API compilada (dist) e as bibliotecas num arquivo só (dist/vercel.cjs),
// para a Vercel não precisar carregar os pacotes do Nest 12, que o carregador
// dela não aceita. Rodado no build da Vercel, depois do "nest build".
import { build } from 'esbuild';

await build({
  entryPoints: ['dist/serverless.js'],
  outfile: 'dist/vercel.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  // O Nest usa o nome das classes para ligar as peças; não pode ser encurtado.
  keepNames: true,
  logLevel: 'warning',
  // Pacotes opcionais que o Nest só tenta carregar se existirem (não usamos).
  external: [
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    '@nestjs/platform-fastify',
    'class-transformer/storage',
    '@fastify/static',
    '@fastify/view',
  ],
});
console.log('✓ dist/vercel.cjs criado');
