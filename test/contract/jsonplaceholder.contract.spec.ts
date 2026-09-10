import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Comment } from '../../src/modules/comments/entities/comment.entity';
import { Post } from '../../src/modules/posts/entities/post.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { createTestApp } from '../support/create-test-app';

// Opt-in: hits the real jsonplaceholder.typicode.com through our own app
// (real routing, real UpstreamService, no nock). Excluded from `npm test`
// and `npm run test:e2e` by filename (`.contract-spec.ts`, not matched by
// either of their testRegex patterns) and by this explicit env-gate, so a
// config run without RUN_CONTRACT_TESTS=1 just skips rather than reaching
// out to the real network. Run with `npm run test:contract`. The point is
// to catch upstream drift that our nock fixtures — which we wrote by hand,
// so they only ever assert what we already believe is true — never could.
const describeIfEnabled =
  process.env['RUN_CONTRACT_TESTS'] === '1' ? describe : describe.skip;

describeIfEnabled('JSONPlaceholder contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /posts returns objects shaped like Post', async () => {
    const response = await request(app.getHttpServer())
      .get('/posts')
      .expect(200);

    const posts = (response.body as { data: Post[] }).data;
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);

    const post = posts[0];
    if (!post) {
      throw new Error('expected at least one post');
    }
    // expect.any() must be a bare argument here, not nested inside an
    // object literal passed to toMatchObject/objectContaining — the latter
    // trips @typescript-eslint/no-unsafe-assignment (see posts.e2e-spec.ts
    // history / PROGRESS.md Phase 3 notes).
    expect(post.id).toEqual(expect.any(Number));
    expect(post.userId).toEqual(expect.any(Number));
    expect(post.title).toEqual(expect.any(String));
    expect(post.body).toEqual(expect.any(String));
  });

  it('GET /posts/:id/comments returns Comment[] scoped to the post', async () => {
    const response = await request(app.getHttpServer())
      .get('/posts/1/comments')
      .expect(200);

    const comments = (response.body as { data: Comment[] }).data;
    expect(comments.length).toBeGreaterThan(0);

    for (const comment of comments) {
      expect(comment.id).toEqual(expect.any(Number));
      expect(comment.postId).toBe(1);
      expect(comment.name).toEqual(expect.any(String));
      expect(comment.email).toEqual(expect.any(String));
      expect(comment.body).toEqual(expect.any(String));
    }
  });

  it('GET /users/:id returns a User with nested address/company/geo', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/1')
      .expect(200);

    const user = (response.body as { data: User }).data;
    expect(user.id).toEqual(expect.any(Number));
    expect(user.name).toEqual(expect.any(String));
    expect(user.username).toEqual(expect.any(String));
    expect(user.email).toEqual(expect.any(String));
    expect(user.phone).toEqual(expect.any(String));
    expect(user.website).toEqual(expect.any(String));

    expect(user.address.street).toEqual(expect.any(String));
    expect(user.address.suite).toEqual(expect.any(String));
    expect(user.address.city).toEqual(expect.any(String));
    expect(user.address.zipcode).toEqual(expect.any(String));
    expect(user.address.geo.lat).toEqual(expect.any(String));
    expect(user.address.geo.lng).toEqual(expect.any(String));

    expect(user.company.name).toEqual(expect.any(String));
    expect(user.company.catchPhrase).toEqual(expect.any(String));
    expect(user.company.bs).toEqual(expect.any(String));
  });
});
