// Função da Vercel: todos os pedidos (/api/...) chegam aqui e vão para a API Nest
// já compilada pelo "pnpm build" (pasta dist). Ver src/serverless.ts.
module.exports = require('../dist/serverless').default;
