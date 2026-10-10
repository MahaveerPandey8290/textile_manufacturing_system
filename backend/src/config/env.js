// Central, validated configuration. The app refuses to boot with a bad config
// instead of failing later in a confusing way.
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().default('textile_mill'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default('postgres'),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(20),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(7000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SESSION_HOURS: z.coerce.number().positive().default(8),
  // Outgoing email (verification codes). Leave SMTP_URL empty in development and the code
  // is printed in the API console instead, e.g. smtps://user:pass@smtp.example.com:465
  SMTP_URL: z.string().optional().default(''),
  MAIL_FROM: z.string().default('MillOS <no-reply@millos.local>'),
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const config = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  sessionCookieName: 'mill_session',
});
