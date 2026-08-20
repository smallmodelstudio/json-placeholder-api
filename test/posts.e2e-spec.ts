import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/create-test-app';
import { mockUpstream } from './support/upstream-mock';

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

      expect(response.body).toEqual(posts);
    });

    it('forwards ?userId= as an upstream query param', async () => {
      const posts = [{ id: 1, userId: 7, title: 'first', body: 'body one' }];
      mockUpstream().get('/posts').query({ userId: '7' }).reply(200, posts);

      const response = await request(app.getHttpServer())
        .get('/posts?userId=7')
        .expect(200);

      expect(response.body).toEqual(posts);
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

      expect(response.body).toEqual(post);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await request(app.getHttpServer()).get('/posts/abc').expect(400);
    });
  });
});
