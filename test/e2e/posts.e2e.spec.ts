import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Comment } from '../../src/modules/comments/entities/comment.entity';
import { Post } from '../../src/modules/posts/entities/post.entity';
import { createTestApp } from '../support/create-test-app';
import { ErrorEnvelope, SuccessEnvelope } from '../support/response-envelope';
import { mockUpstream } from '../support/upstream-mock';

describe('Posts (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /posts', () => {
    it('returns the list of posts from upstream', async () => {
      const posts = [
        { id: 1, userId: 1, title: 'first', body: 'body one' },
        { id: 2, userId: 1, title: 'second', body: 'body two' },
      ];
      mockUpstream().get('/posts').reply(200, posts);

      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      const body = response.body as SuccessEnvelope<Post[]>;
      expect(body.data).toEqual(posts);
    });

    it('forwards ?userId= as an upstream query param', async () => {
      const posts = [{ id: 1, userId: 7, title: 'first', body: 'body one' }];
      mockUpstream().get('/posts').query({ userId: '7' }).reply(200, posts);

      const response = await request(app.getHttpServer())
        .get('/posts?userId=7')
        .expect(200);

      const body = response.body as SuccessEnvelope<Post[]>;
      expect(body.data).toEqual(posts);
    });

    it('rejects a non-numeric userId with 400', async () => {
      await request(app.getHttpServer()).get('/posts?userId=abc').expect(400);
    });
  });

  describe('GET /posts/:id', () => {
    it('returns a single post from upstream', async () => {
      const post = { id: 1, userId: 1, title: 'first', body: 'body one' };
      mockUpstream().get('/posts/1').reply(200, post);

      const response = await request(app.getHttpServer())
        .get('/posts/1')
        .expect(200);

      const body = response.body as SuccessEnvelope<Post>;
      expect(body.data).toEqual(post);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await request(app.getHttpServer()).get('/posts/abc').expect(400);
    });
  });

  describe('POST /posts', () => {
    it('creates a post and returns the upstream response', async () => {
      const dto = { title: 'new title', body: 'new body', userId: 1 };
      const created = { id: 101, ...dto };
      mockUpstream().post('/posts', dto).reply(201, created);

      const response = await request(app.getHttpServer())
        .post('/posts')
        .send(dto)
        .expect(201);

      const body = response.body as SuccessEnvelope<Post>;
      expect(body.data).toEqual(created);
    });

    it('rejects a payload missing required fields with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/posts')
        .send({ title: 'only a title' })
        .expect(400);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(Array.isArray(body.message)).toBe(true);
    });

    it('rejects an unknown property with 400', async () => {
      await request(app.getHttpServer())
        .post('/posts')
        .send({ title: 't', body: 'b', userId: 1, extra: 'nope' })
        .expect(400);
    });
  });

  describe('PUT /posts/:id', () => {
    it('replaces a post and returns the upstream response', async () => {
      const dto = { title: 'replaced', body: 'replaced body', userId: 1 };
      const updated = { id: 1, ...dto };
      mockUpstream().put('/posts/1', dto).reply(200, updated);

      const response = await request(app.getHttpServer())
        .put('/posts/1')
        .send(dto)
        .expect(200);

      const body = response.body as SuccessEnvelope<Post>;
      expect(body.data).toEqual(updated);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await request(app.getHttpServer())
        .put('/posts/abc')
        .send({ title: 't', body: 'b', userId: 1 })
        .expect(400);
    });

    it('rejects an invalid field type with 400', async () => {
      await request(app.getHttpServer())
        .put('/posts/1')
        .send({ title: 't', body: 'b', userId: 'not-a-number' })
        .expect(400);
    });
  });

  describe('PATCH /posts/:id', () => {
    it('partially updates a post and returns the upstream response', async () => {
      const dto = { title: 'patched title' };
      const patched = { id: 1, userId: 1, title: 'patched title', body: 'b' };
      mockUpstream().patch('/posts/1', dto).reply(200, patched);

      const response = await request(app.getHttpServer())
        .patch('/posts/1')
        .send(dto)
        .expect(200);

      const body = response.body as SuccessEnvelope<Post>;
      expect(body.data).toEqual(patched);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await request(app.getHttpServer())
        .patch('/posts/abc')
        .send({ title: 't' })
        .expect(400);
    });
  });

  describe('DELETE /posts/:id', () => {
    it('deletes a post and returns the upstream response', async () => {
      mockUpstream().delete('/posts/1').reply(200, {});

      const response = await request(app.getHttpServer())
        .delete('/posts/1')
        .expect(200);

      const body = response.body as SuccessEnvelope<object>;
      expect(body.data).toEqual({});
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await request(app.getHttpServer()).delete('/posts/abc').expect(400);
    });
  });

  describe('GET /posts/:id/comments', () => {
    it('returns the comments belonging to the post', async () => {
      const comments = [
        { id: 1, postId: 1, name: 'n', email: 'e@example.com', body: 'b' },
      ];
      mockUpstream()
        .get('/comments')
        .query({ postId: '1' })
        .reply(200, comments);

      const response = await request(app.getHttpServer())
        .get('/posts/1/comments')
        .expect(200);

      const body = response.body as SuccessEnvelope<Comment[]>;
      expect(body.data).toEqual(comments);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await request(app.getHttpServer()).get('/posts/abc/comments').expect(400);
    });
  });
});
