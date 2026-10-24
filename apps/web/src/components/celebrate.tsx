'use client';

import { Icon, type IconName } from './icon';
import { Sheet, useSheets } from './sheet';
import { Button } from './ui/button';

export type Celebration = { icon?: IconName; title: string; text: string; xp?: number };

/**
 * Folha de comemoração (épico encerrado, sprint concluída, iniciativa concluída…),
 * como a Celebrate do protótipo. O botão "Compartilhar" no feed chega na etapa 17.
 */
export function CelebrateSheet({ data, onClose }: { data: Celebration; onClose: () => void }) {
  return (
    <Sheet title="" onClose={onClose}>
      <div className="pb-2 text-center">
        <div className="burst mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon n={data.icon ?? 'trophy'} className="h-11 w-11" sw={1.6} />
        </div>
        <h2 className="mt-4 text-2xl font-bold">{data.title}</h2>
        <p className="mt-1 text-muted">{data.text}</p>
        {(data.xp ?? 0) > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 font-bold text-amber-600">
            <Icon n="star" className="h-4 w-4" fill="currentColor" />+{data.xp} XP
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={onClose}>
            Continuar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export function useCelebrate() {
  const { openSheet } = useSheets();
  return (data: Celebration) => openSheet(close => <CelebrateSheet data={data} onClose={close} />);
}
