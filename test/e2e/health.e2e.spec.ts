import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { api } from '../support/api';
import { createTestApp } from '../support/create-test-app';
import { ErrorEnvelope } from '../support/response-envelope';
import { mockUpstream } from '../support/upstream-mock';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health/live reports healthy without touching the upstream', async () => {
    const response = await api(app).get('/health/live').expect(200);

    const body = response.body as {
      data: { status: string; info?: Record<string, unknown> };
    };
    expect(body.data.status).toBe('ok');
  });

  it('/health/ready reports healthy when the upstream ping succeeds', async () => {
    mockUpstream().get('/posts/1').reply(200, { id: 1 });

    const response = await api(app).get('/health/ready').expect(200);

    const body = response.body as {
      data: { status: string; info?: Record<string, unknown> };
    };
    expect(body.data.status).toBe('ok');
    expect(body.data.info).toHaveProperty('upstream');
  });

  it('/health/ready reports unhealthy with 503, in the standard error envelope', async () => {
    mockUpstream().get('/posts/1').reply(500);

    const response = await api(app).get('/health/ready').expect(503);

    // Naming the failed check here (rather than leaking Terminus's own
    // HealthCheckResult into the error envelope) is HealthController's job
    // — see the try/catch in health.controller.ts.
    const body = response.body as ErrorEnvelope;
    expect(body).toMatchObject({
      statusCode: 503,
      message: 'Health check failed: upstream',
      error: 'Service Unavailable',
      path: '/health/ready',
    });
    expect(body.timestamp).toEqual(expect.any(String));
    expect(body.correlationId).toEqual(expect.any(String));
  });
});
