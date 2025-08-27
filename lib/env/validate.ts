import { z } from 'zod';

const EnvSchema = z.object({
  QN_STREAMS_TOKEN: z.string().optional(),
  QN_PUMPFUN_TOKEN: z.string().optional(),
  QN_ALLOW_UNSIGNED: z.union([z.literal('1'), z.literal('0'), z.string(), z.boolean()]).optional(),
  DEBUG_TOKEN: z.string().optional(),
  NODE_ENV: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
});

export function getValidatedEnv() {
  const res = EnvSchema.safeParse(process.env);
  if (!res.success) {
    console.warn('[env] Validation warnings:', res.error.format());
    return process.env;
  }
  return res.data;
}