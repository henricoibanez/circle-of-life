import { HealthStatus } from './health-status';

// Página provisória da etapa 0: confirma que site, API, banco e storage
// estão conversando. As telas de verdade começam na etapa 3.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4">
      <h1 className="text-4xl tracking-tight">
        <span className="font-semibold text-[rgb(var(--p))]">Circle</span>{' '}
        <span className="opacity-60">of</span>{' '}
        <span className="font-semibold text-[rgb(var(--p))]">Life</span>
      </h1>
      <p className="opacity-70">Fundação do projeto pronta. Abaixo, o estado de cada parte do sistema.</p>
      <HealthStatus />
    </main>
  );
}
