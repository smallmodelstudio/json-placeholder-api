import { AppConfig } from './config.types';
import { validate } from './env.validation';

// Nest's `ConfigModule.forRoot({ validate, load: [configuration] })` already
// runs `validate(process.env)` once during startup and defaults belong there
// (`env.validation.ts`) alone — calling it again here, rather than
// re-parsing `process.env` with a second, separately-maintained set of
// defaults, is what keeps this the only other place that has to agree with
// it: field names and nesting, not default values.
export default (): AppConfig => {
  const env = validate(process.env);

  return {
    env: env.NODE_ENV,
    port: env.PORT,
    http: {
      baseUrl: env.UPSTREAM_BASE_URL,
      timeoutMs: env.UPSTREAM_TIMEOUT_MS,
      maxRetries: env.UPSTREAM_MAX_RETRIES,
    },
    cache: {
      ttlMs: env.CACHE_TTL_MS,
    },
    throttle: {
      ttlMs: env.THROTTLE_TTL_MS,
      limit: env.THROTTLE_LIMIT,
    },
  };
};
