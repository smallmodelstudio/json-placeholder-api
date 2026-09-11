import { describe, it, expect } from 'vitest';
import { validate } from './env.validation';

describe('validate', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: '3000',
    UPSTREAM_BASE_URL: 'https://jsonplaceholder.typicode.com',
    UPSTREAM_TIMEOUT_MS: '5000',
    UPSTREAM_MAX_RETRIES: '2',
  };

  it('accepts a valid environment and coerces types', () => {
    const result = validate(validEnv);

    expect(result.PORT).toBe(3000);
    expect(result.UPSTREAM_TIMEOUT_MS).toBe(5000);
  });

  it('falls back to defaults when optional-looking values are absent', () => {
    const result = validate({});

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => validate({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => validate({ ...validEnv, PORT: 'not-a-number' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('rejects a PORT outside the valid range', () => {
    expect(() => validate({ ...validEnv, PORT: '70000' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('rejects a malformed UPSTREAM_BASE_URL', () => {
    expect(() =>
      validate({ ...validEnv, UPSTREAM_BASE_URL: 'not-a-url' }),
    ).toThrow(/Invalid environment variables/);
  });

  it('accepts a zero CACHE_TTL_MS', () => {
    const result = validate({ ...validEnv, CACHE_TTL_MS: '0' });

    expect(result.CACHE_TTL_MS).toBe(0);
  });

  it('rejects a negative CACHE_TTL_MS', () => {
    expect(() => validate({ ...validEnv, CACHE_TTL_MS: '-1' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('rejects a THROTTLE_TTL_MS below 1', () => {
    expect(() => validate({ ...validEnv, THROTTLE_TTL_MS: '0' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('rejects a THROTTLE_LIMIT below 1', () => {
    expect(() => validate({ ...validEnv, THROTTLE_LIMIT: '0' })).toThrow(
      /Invalid environment variables/,
    );
  });
});
