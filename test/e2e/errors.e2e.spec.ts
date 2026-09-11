import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Post } from '../../src/modules/posts/entities/post.entity';
import { api } from '../support/api';
import { createTestApp } from '../support/create-test-app';
import { ErrorEnvelope, SuccessEnvelope } from '../support/response-envelope';
import { mockUpstream } from '../support/upstream-mock';
import { withEnvOverrides } from '../support/with-env-overrides';

describe('Cross-cutting error handling (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('response envelope', () => {
    it('wraps a successful response in a data/meta envelope', async () => {
      const post = { id: 1, userId: 1, title: 'first', body: 'body one' };
      mockUpstream().get('/posts/1').reply(200, post);

      const response = await api(app).get('/posts/1').expect(200);

      const body = response.body as SuccessEnvelope<Post>;
      expect(body.data).toEqual(post);
      expect(body.meta.timestamp).toEqual(expect.any(String));
      expect(body.meta.correlationId).toEqual(expect.any(String));
    });
  });

  describe('correlation ids', () => {
    it('echoes a client-supplied correlation id on the response header and envelope', async () => {
      mockUpstream()
        .get('/posts/1')
        .reply(200, { id: 1, userId: 1, title: 't', body: 'b' });

      const response = await api(app)
        .get('/posts/1')
        .set('x-correlation-id', 'test-correlation-123')
        .expect(200);

      const body = response.body as SuccessEnvelope<Post>;
      expect(response.headers['x-correlation-id']).toBe('test-correlation-123');
      expect(body.meta.correlationId).toBe('test-correlation-123');
    });

    it('generates a correlation id when the client does not supply one', async () => {
      mockUpstream()
        .get('/posts/1')
        .reply(200, { id: 1, userId: 1, title: 't', body: 'b' });

      const response = await api(app).get('/posts/1').expect(200);

      const body = response.body as SuccessEnvelope<Post>;
      const correlationHeader = response.headers['x-correlation-id'];
      expect(correlationHeader).toEqual(expect.any(String));
      expect(body.meta.correlationId).toBe(correlationHeader);
    });

    it('generates a correlation id instead of echoing one outside the allowed charset', async () => {
      mockUpstream()
        .get('/posts/1')
        .reply(200, { id: 1, userId: 1, title: 't', body: 'b' });

      const response = await api(app)
        .get('/posts/1')
        .set('x-correlation-id', 'not a valid id!')
        .expect(200);

      const body = response.body as SuccessEnvelope<Post>;
      expect(response.headers['x-correlation-id']).not.toBe('not a valid id!');
      expect(body.meta.correlationId).toBe(
        response.headers['x-correlation-id'],
      );
    });
  });

  describe('validation rejection', () => {
    it('returns a 400 envelope with field-level messages', async () => {
      const response = await api(app).get('/posts?userId=abc').expect(400);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        path: '/posts?userId=abc',
      });
      expect(body.timestamp).toEqual(expect.any(String));
      expect(body.correlationId).toEqual(expect.any(String));
      expect(Array.isArray(body.message)).toBe(true);
    });
  });

  describe('upstream failures', () => {
    it('maps an upstream 500 (after retries exhaust) to a 502 envelope', async () => {
      mockUpstream().persist().get('/posts/1').reply(500);

      const response = await api(app).get('/posts/1').expect(502);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({
        statusCode: 502,
        error: 'Bad Gateway',
        path: '/posts/1',
      });
    });

    it('maps an upstream timeout (after retries exhaust) to a 504 envelope', async () => {
      // Real .env values (5000ms timeout, 2 retries) would make this test
      // slow, so give this one bootstrap a much smaller budget — dotenv
      // won't clobber a value already present in process.env, so this
      // override wins over .env for the app created inside the callback.
      await withEnvOverrides(
        { UPSTREAM_TIMEOUT_MS: '50', UPSTREAM_MAX_RETRIES: '0' },
        async () => {
          const timeoutApp = await createTestApp();
          try {
            mockUpstream()
              .persist()
              .get('/posts/1')
              .delayConnection(200)
              .reply(200, {});

            const response = await api(timeoutApp).get('/posts/1').expect(504);

            const body = response.body as ErrorEnvelope;
            expect(body).toMatchObject({
              statusCode: 504,
              error: 'Gateway Timeout',
              path: '/posts/1',
            });
          } finally {
            await timeoutApp.close();
          }
        },
      );
    });

    it('passes through an upstream 404 unchanged', async () => {
      mockUpstream().get('/posts/999').reply(404);

      const response = await api(app).get('/posts/999').expect(404);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({
        statusCode: 404,
        path: '/posts/999',
      });
    });

    it("doesn't leak the upstream method/path into the client-facing message", async () => {
      mockUpstream().get('/posts/999').reply(404);

      const response = await api(app).get('/posts/999').expect(404);

      const body = response.body as ErrorEnvelope;
      // Real bug this guards against: the message used to be built from
      // UpstreamService's internal `describe(config)` ("Upstream responded
      // with 404: GET /posts/999"), leaking upstream request detail to the
      // client instead of a generic, status-derived message.
      expect(body.message).toBe('Not Found');
      expect(body.message).not.toContain('GET');
      expect(body.message).not.toContain('Upstream');
    });
  });

  describe('unknown routes', () => {
    it('returns a 404 envelope for a route with no matching handler', async () => {
      const response = await api(app).get('/nonexistent-route').expect(404);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        path: '/nonexistent-route',
      });
      expect(body.timestamp).toEqual(expect.any(String));
      expect(body.correlationId).toEqual(expect.any(String));
    });
  });
});
