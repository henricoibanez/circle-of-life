import { z } from 'zod';

/** "true"/"false" vindos do .env viram booleanos de verdade. */
const bool = z.enum(['true', 'false']).transform(v => v === 'true');

/**
 * Todas as variáveis de ambiente que a API usa. Se faltar alguma ou o
 * formato estiver errado, a API não inicia e mostra o que corrigir.
 * Ao criar uma variável nova, acrescente aqui e nos .env.example.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.url(),

  DATABASE_URL: z.string().startsWith('postgres', 'deve começar com postgresql://'),

  S3_ENDPOINT: z.url(),
  S3_PUBLIC_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: bool.default(true),
  S3_CREATE_BUCKET: bool.default(false),
  S3_CORS_ORIGINS: z.string().transform(v => v.split(',').map(s => s.trim()).filter(Boolean)),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map(i => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Variáveis de ambiente inválidas ou ausentes:\n${problems}\nConfira o arquivo .env (modelo em .env.example).`);
  }
  return result.data;
}
