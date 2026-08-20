import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Post } from '../src/modules/posts/entities/post.entity';
import { createTestApp } from './support/create-test-app';
import { SuccessEnvelope } from './support/response-envelope';
import { mockUpstream } from './support/upstream-mock';

describe('Response caching (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves a second GET /posts within the TTL from cache, without re-hitting upstream', async () => {
    const posts: Post[] = [{ id: 1, userId: 1, title: 't', body: 'b' }];
    // Only one nock interceptor is registered — if the second request re-hit
    // upstream, it would fail (net connect is disabled), so both responses
    // succeeding proves the second one was served from cache.
    mockUpstream().get('/posts').reply(200, posts);

    const first = await request(app.getHttpServer()).get('/posts').expect(200);
    const second = await request(app.getHttpServer()).get('/posts').expect(200);

    expect((first.body as SuccessEnvelope<Post[]>).data).toEqual(posts);
    expect((second.body as SuccessEnvelope<Post[]>).data).toEqual(posts);
    // A fresh correlation id per response proves TransformInterceptor still
    // runs — and wraps a fresh envelope — even on a cache hit.
    expect(
      (second.body as SuccessEnvelope<Post[]>).meta.correlationId,
    ).not.toBe((first.body as SuccessEnvelope<Post[]>).meta.correlationId);
  });

  it('serves a second GET /posts/:id within its per-route TTL from cache', async () => {
    const post: Post = { id: 1, userId: 1, title: 't', body: 'b' };
    mockUpstream().get('/posts/1').reply(200, post);

    await request(app.getHttpServer()).get('/posts/1').expect(200);
    const second = await request(app.getHttpServer())
      .get('/posts/1')
      .expect(200);

    expect((second.body as SuccessEnvelope<Post>).data).toEqual(post);
  });

  it('caches GET requests separately per query string', async () => {
    const forUser1: Post[] = [{ id: 1, userId: 1, title: 't1', body: 'b1' }];
    const forUser2: Post[] = [{ id: 2, userId: 2, title: 't2', body: 'b2' }];
    mockUpstream().get('/posts').query({ userId: '1' }).reply(200, forUser1);
    mockUpstream().get('/posts').query({ userId: '2' }).reply(200, forUser2);

    const responseUser1 = await request(app.getHttpServer())
      .get('/posts?userId=1')
      .expect(200);
    const responseUser2 = await request(app.getHttpServer())
      .get('/posts?userId=2')
      .expect(200);

    expect((responseUser1.body as SuccessEnvelope<Post[]>).data).toEqual(
      forUser1,
    );
    expect((responseUser2.body as SuccessEnvelope<Post[]>).data).toEqual(
      forUser2,
    );
  });

  it('never caches writes', async () => {
    const dto = { title: 't', body: 'b', userId: 1 };
    const created = { id: 101, ...dto };
    // Two interceptors, each consumable once. If POST were (wrongly)
    // cached, the second request would be served from cache without
    // consuming the second interceptor, and scope.isDone() would be false.
    const scope = mockUpstream()
      .post('/posts', dto)
      .reply(201, created)
      .post('/posts', dto)
      .reply(201, created);

    await request(app.getHttpServer()).post('/posts').send(dto).expect(201);
    await request(app.getHttpServer()).post('/posts').send(dto).expect(201);

    expect(scope.isDone()).toBe(true);
  });
});
