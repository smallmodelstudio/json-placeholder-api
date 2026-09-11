import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import configuration from './configuration';

const ENV_KEYS = [
  'NODE_ENV',
  'PORT',
  'UPSTREAM_BASE_URL',
  'UPSTREAM_TIMEOUT_MS',
  'UPSTREAM_MAX_RETRIES',
  'CACHE_TTL_MS',
  'THROTTLE_TTL_MS',
  'THROTTLE_LIMIT',
] as const;

describe('configuration', () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it('maps env.validation.ts defaults into AppConfig when nothing is set', () => {
    expect(configuration()).toEqual({
      env: 'development',
      port: 3000,
      http: {
        baseUrl: 'https://jsonplaceholder.typicode.com',
        timeoutMs: 5000,
        maxRetries: 2,
      },
      cache: { ttlMs: 30000 },
      throttle: { ttlMs: 60000, limit: 20 },
    });
  });

  it('reflects overridden env vars, coerced to the right types', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PORT'] = '8080';
    process.env['UPSTREAM_MAX_RETRIES'] = '5';

    const config = configuration();

    expect(config.env).toBe('production');
    expect(config.port).toBe(8080);
    expect(config.http.maxRetries).toBe(5);
  });

  it('throws the same validation error as env.validation.ts for an invalid value', () => {
    process.env['NODE_ENV'] = 'not-a-real-environment';

    expect(() => configuration()).toThrow(/Invalid environment variables/);
  });
});
