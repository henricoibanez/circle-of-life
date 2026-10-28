'use client';

import Link from 'next/link';
import { Leaves } from '@/components/art';
import { Icon, type IconName } from '@/components/icon';
import { Avatar } from '@/components/primitives';
import { tint } from '@/lib/color';
import { useMe } from '@/lib/me';

function Row({ href, n, title, d, c }: { href: string; n: IconName; title: string; d: string; c?: string }) {
  return (
    <Link href={href} className="flex w-full items-center gap-4 rounded-2xl border border-line/80 bg-surface p-4 text-left shadow-soft hover:border-primary/40">
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
        style={{ background: c ? tint(c, 0.12) : 'rgb(var(--p) / .1)', color: c || 'rgb(var(--p))' }}
      >
        <Icon n={n} className="h-6 w-6" sw={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{d}</span>
      </span>
      <Icon n="chevR" className="h-4 w-4 text-muted" />
    </Link>
  );
}

/** Tela "Mais": perfil e atalhos para as ferramentas, como no protótipo. */
export default function MaisPage() {
  const { data: me } = useMe();
  return (
    <div className="relative overflow-hidden">
      <Leaves className="pointer-events-none absolute -right-10 -top-6 h-64 w-64" />
      <header className="relative px-4 pb-4 pt-5">
        <h1 className="text-[2rem] font-bold tracking-tight">Mais</h1>
      </header>
      <div className="relative space-y-6 px-4 pb-8">
        <Link href="/perfil" className="flex w-full items-center gap-4 rounded-2xl border border-line/80 bg-surface p-4 text-left shadow-soft">
          <Avatar name={me?.name ?? '?'} photo={me?.photoUrl} size="w-14 h-14 text-lg" />
          <span className="min-w-0 flex-1">
            <span className="block text-[1.0625rem] font-semibold">{me?.name ?? ' '}</span>
            <span className="block text-sm text-muted">{me ? `${me.xp.total.toLocaleString('pt-BR')} XP` : ' '}</span>
          </span>
          <Icon n="chevR" className="h-4 w-4 text-muted" />
        </Link>

        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-muted">Planejamento</h2>
          <Row href="/backlog" n="backlog" title="Backlog" d="Suas iniciativas, épicos e tarefas." />
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-muted">Ferramentas de reflexão</h2>
          <Row href="/necrologio" n="feather" c="#7c4dde" title="Necrológio" d="Reflita sobre sua vida e o legado que deseja deixar." />
          <Row href="/maslow" n="triangle" title="Pirâmide de Maslow" d="Entenda suas prioridades e necessidades." />
          <Row href="/roda" n="wheel" c="#3b82f6" title="Roda da Vida" d="Avalie e evolua em equilíbrio." />
          <Row href="/quadro" n="eye" c="#f59e0b" title="Quadro de visualização" d="Seus sonhos e as conquistas da sua vida." />
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-muted">Acompanhamento</h2>
          <Row href="/analise" n="sparkles" c="#7c4dde" title="Análise inteligente" d="A IA cruza seus exercícios com o que você executa." />
          <Row href="/relatorios" n="chart" c="#7c4dde" title="Relatórios" d="Acompanhe seu progresso e evolução." />
          <Row href="/loja" n="bag" c="#ef4444" title="Loja de trilhas" d="Trilhas prontas para importar no backlog." />
          <Row href="/perfil" n="settings" c="#6b7280" title="Configurações" d="Ajustes da sua conta e do app." />
        </section>

        {me?.role === 'admin' && (
          <section className="space-y-3">
            <h2 className="px-1 text-sm font-semibold text-muted">Administração</h2>
            <Row href="/admin/convites" n="envelope" c="#0ea5e9" title="Convites" d="Convide pessoas por e-mail para entrar no app." />
          </section>
        )}
      </div>
    </div>
  );
}
