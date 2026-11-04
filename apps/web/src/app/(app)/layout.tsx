import { BottomNav } from '@/components/bottom-nav';
import { JourneyDoneCelebration } from '@/components/journey';
import { ThemeSync } from '@/components/providers';

/** Área logada: conteúdo centralizado (largura de celular) e barra inferior. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeSync />
      <div className="mx-auto min-h-[100dvh] max-w-2xl pb-32">{children}</div>
      <BottomNav />
      <JourneyDoneCelebration />
    </>
  );
}
