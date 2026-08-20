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
});
