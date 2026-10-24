import { Icon, type IconName } from './icon';

/** Aviso provisório para telas que ainda serão construídas (cada uma tem sua etapa no plano). */
export function Soon({ icon = 'sparkles', title, stage, children }: { icon?: IconName; title: string; stage: number; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon n={icon} className="h-8 w-8" sw={1.6} />
      </span>
      <p className="mt-4 text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">Esta tela chega na etapa {stage} do plano.</p>
      {children}
    </div>
  );
}
