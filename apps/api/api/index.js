// Função da Vercel: todos os pedidos (/api/...) chegam aqui e vão para a API Nest
// já compilada e juntada num arquivo só (dist/vercel.cjs, ver scripts/vercel-bundle.mjs).
// O carregador da Vercel não aceita os pacotes do Nest 12 separados.
module.exports = require('../dist/vercel.cjs').default;
