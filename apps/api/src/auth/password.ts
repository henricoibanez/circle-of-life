import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** Senha mínima: 8 caracteres. */
export const MIN_PASSWORD = 8;

/** Guarda só o resumo da senha (scrypt com sal aleatório), no formato "scrypt$sal$resumo". */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function checkPassword(password: string, stored: string | null) {
  const [kind, salt, hash] = (stored ?? '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(key, expected);
}

/** Código de 6 números para mandar por e-mail. */
export const newEmailCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const hashEmailCode = (code: string) => createHash('sha256').update(code).digest('hex');
