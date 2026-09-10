import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../support/create-test-app';
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
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);

    const body = response.body as {
      data: { status: string; info?: Record<string, unknown> };
    };
    expect(body.data.status).toBe('ok');
  });

  it('/health/ready reports healthy when the upstream ping succeeds', async () => {
    mockUpstream().get('/posts/1').reply(200, { id: 1 });

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);

    const body = response.body as {
      data: { status: string; info?: Record<string, unknown> };
    };
    expect(body.data.status).toBe('ok');
    expect(body.data.info).toHaveProperty('upstream');
  });

  it('/health/ready reports unhealthy with 503 when the upstream ping fails', async () => {
    mockUpstream().get('/posts/1').reply(500);

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);

    const body = response.body as { statusCode: number };
    expect(body.statusCode).toBe(503);
  });
});
