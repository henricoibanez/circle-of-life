import type { ReactNode } from 'react';

/**
 * Texto das novidades: parágrafos separados por linha em branco e linhas que
 * começam com "- " viram itens de lista. Só texto (nada de HTML).
 */
export function ReleaseBody({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map(b => b.split('\n').filter(l => l.trim()));
  return (
    <div className="space-y-3 text-[0.9375rem] leading-relaxed">
      {blocks.map((lines, i) => {
        const items = lines.filter(l => /^\s*[-•]\s+/.test(l));
        if (items.length === lines.length && items.length)
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {items.map((l, j) => (
                <li key={j}>{l.replace(/^\s*[-•]\s+/, '')}</li>
              ))}
            </ul>
          );
        const out: ReactNode[] = [];
        lines.forEach((l, j) => {
          if (j) out.push(<br key={`br${j}`} />);
          out.push(l);
        });
        return <p key={i}>{out}</p>;
      })}
    </div>
  );
}
