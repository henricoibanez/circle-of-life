/**
 * Cria o "ID" público da pessoa (aparece como @handle) a partir do nome:
 * sem acentos, minúsculo, só letras e números. Ex.: "Bárbara Sajo" → "barbarasajo".
 */
export function baseHandle(name: string, email: string): string {
  const fromName = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const fromEmail = email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (fromName || fromEmail || 'pessoa').slice(0, 24);
}

/** Primeiro handle livre: "nome", "nome2", "nome3"… */
export async function uniqueHandle(name: string, email: string, isTaken: (h: string) => Promise<boolean>) {
  const base = baseHandle(name, email);
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? base : `${base}${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
}
