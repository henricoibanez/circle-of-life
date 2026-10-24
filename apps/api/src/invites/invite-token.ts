import { createHash, randomBytes } from 'node:crypto';

/** Gera o código secreto que vai no link do convite. */
export const newInviteToken = () => randomBytes(32).toString('base64url');

/** O banco guarda só o resumo (hash) do código, nunca o código em si. */
export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex');

export type InviteStatus = 'pendente' | 'aceito' | 'expirado';

export function inviteStatus(invite: { acceptedAt: Date | null; expiresAt: Date }, now = new Date()): InviteStatus {
  if (invite.acceptedAt) return 'aceito';
  return invite.expiresAt <= now ? 'expirado' : 'pendente';
}

/** E-mails são comparados sempre em minúsculas e sem espaços. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
