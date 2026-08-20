import { AppConfig } from './config.types';

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  http: {
    baseUrl:
      process.env.UPSTREAM_BASE_URL ?? 'https://jsonplaceholder.typicode.com',
    timeoutMs: parseInt(process.env.UPSTREAM_TIMEOUT_MS ?? '5000', 10),
    maxRetries: parseInt(process.env.UPSTREAM_MAX_RETRIES ?? '2', 10),
  },
  cache: {
    ttlMs: parseInt(process.env.CACHE_TTL_MS ?? '30000', 10),
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '20', 10),
  },
});
