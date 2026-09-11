import { describe, it, afterEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { api } from '../support/api';
import { createTestApp } from '../support/create-test-app';
import { mockUpstream } from '../support/upstream-mock';
import { withEnvOverrides } from '../support/with-env-overrides';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  it('returns 429 once the configured request limit is exceeded', async () => {
    await withEnvOverrides(
      { THROTTLE_LIMIT: '2', THROTTLE_TTL_MS: '10000' },
      async () => {
        app = await createTestApp();
        mockUpstream().get('/posts').times(2).reply(200, []);

        await api(app).get('/posts').expect(200);
        await api(app).get('/posts').expect(200);
        await api(app).get('/posts').expect(429);
      },
    );
  });

  it('exempts /health/ready from the rate limit', async () => {
    await withEnvOverrides(
      { THROTTLE_LIMIT: '1', THROTTLE_TTL_MS: '10000' },
      async () => {
        app = await createTestApp();
        mockUpstream().get('/posts/1').times(3).reply(200, { id: 1 });

        await api(app).get('/health/ready').expect(200);
        await api(app).get('/health/ready').expect(200);
        await api(app).get('/health/ready').expect(200);
      },
    );
  });
});
