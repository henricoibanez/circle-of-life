/** "agora", "há 5 min", "há 3h", "ontem", "há 4 dias" (como no protótipo). */
export function since(d: string | Date) {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.round(m / 60)}h`;
  const days = Math.round(m / 1440);
  return days === 1 ? 'ontem' : `há ${days} dias`;
}
