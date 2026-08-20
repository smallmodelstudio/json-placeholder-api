import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Comment } from '../src/modules/comments/entities/comment.entity';
import { createTestApp } from './support/create-test-app';
import { ErrorEnvelope, SuccessEnvelope } from './support/response-envelope';
import { mockUpstream } from './support/upstream-mock';

describe('Comments (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /comments', () => {
    it('returns the list of comments from upstream', async () => {
      const comments = [
        { id: 1, postId: 1, name: 'n', email: 'e@example.com', body: 'b' },
      ];
      mockUpstream().get('/comments').reply(200, comments);

      const response = await request(app.getHttpServer())
        .get('/comments')
        .expect(200);

      const body = response.body as SuccessEnvelope<Comment[]>;
      expect(body.data).toEqual(comments);
    });

    it('forwards ?postId= as an upstream query param', async () => {
      const comments = [
        { id: 1, postId: 7, name: 'n', email: 'e@example.com', body: 'b' },
      ];
      mockUpstream()
        .get('/comments')
        .query({ postId: '7' })
        .reply(200, comments);

      const response = await request(app.getHttpServer())
        .get('/comments?postId=7')
        .expect(200);

      const body = response.body as SuccessEnvelope<Comment[]>;
      expect(body.data).toEqual(comments);
    });
  });

  describe('GET /comments/:id', () => {
    it('returns a single comment from upstream', async () => {
      const comment = {
        id: 1,
        postId: 1,
        name: 'n',
        email: 'e@example.com',
        body: 'b',
      };
      mockUpstream().get('/comments/1').reply(200, comment);

      const response = await request(app.getHttpServer())
        .get('/comments/1')
        .expect(200);

      const body = response.body as SuccessEnvelope<Comment>;
      expect(body.data).toEqual(comment);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await request(app.getHttpServer()).get('/comments/abc').expect(400);
    });
  });

  describe('POST /comments', () => {
    it('creates a comment and returns the upstream response', async () => {
      const dto = {
        postId: 1,
        name: 'n',
        email: 'e@example.com',
        body: 'b',
      };
      const created = { id: 501, ...dto };
      mockUpstream().post('/comments', dto).reply(201, created);

      const response = await request(app.getHttpServer())
        .post('/comments')
        .send(dto)
        .expect(201);

      const body = response.body as SuccessEnvelope<Comment>;
      expect(body.data).toEqual(created);
    });

    it('rejects an invalid email with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/comments')
        .send({ postId: 1, name: 'n', email: 'not-an-email', body: 'b' })
        .expect(400);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });
  });

  describe('PUT /comments/:id', () => {
    it('replaces a comment and returns the upstream response', async () => {
      const dto = {
        postId: 1,
        name: 'replaced',
        email: 'e@example.com',
        body: 'b',
      };
      const updated = { id: 1, ...dto };
      mockUpstream().put('/comments/1', dto).reply(200, updated);

      const response = await request(app.getHttpServer())
        .put('/comments/1')
        .send(dto)
        .expect(200);

      const body = response.body as SuccessEnvelope<Comment>;
      expect(body.data).toEqual(updated);
    });
  });

  describe('PATCH /comments/:id', () => {
    it('partially updates a comment and returns the upstream response', async () => {
      const dto = { name: 'patched' };
      const patched = {
        id: 1,
        postId: 1,
        name: 'patched',
        email: 'e@example.com',
        body: 'b',
      };
      mockUpstream().patch('/comments/1', dto).reply(200, patched);

      const response = await request(app.getHttpServer())
        .patch('/comments/1')
        .send(dto)
        .expect(200);

      const body = response.body as SuccessEnvelope<Comment>;
      expect(body.data).toEqual(patched);
    });
  });

  describe('DELETE /comments/:id', () => {
    it('deletes a comment and returns the upstream response', async () => {
      mockUpstream().delete('/comments/1').reply(200, {});

      const response = await request(app.getHttpServer())
        .delete('/comments/1')
        .expect(200);

      const body = response.body as SuccessEnvelope<object>;
      expect(body.data).toEqual({});
    });
  });
});
