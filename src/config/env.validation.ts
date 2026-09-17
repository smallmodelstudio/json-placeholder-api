import { z } from 'zod';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export const EnvironmentVariablesSchema = z.looseObject({
  NODE_ENV: z.enum(Environment).default(Environment.Development),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  UPSTREAM_BASE_URL: z
    .url({ protocol: /^https?$/ })
    .default('https://jsonplaceholder.typicode.com'),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1).default(5000),
  UPSTREAM_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  CACHE_TTL_MS: z.coerce.number().int().min(0).default(30000),
  THROTTLE_TTL_MS: z.coerce.number().int().min(1).default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().min(1).default(20),
});

export type EnvironmentVariables = z.output<typeof EnvironmentVariablesSchema>;

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const result = EnvironmentVariablesSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
