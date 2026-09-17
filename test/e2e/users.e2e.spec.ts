import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Album } from '../../src/modules/albums/entities/album.entity';
import { Post } from '../../src/modules/posts/entities/post.entity';
import { Todo } from '../../src/modules/todos/entities/todo.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { api } from '../support/api';
import { createTestApp } from '../support/create-test-app';
import { ErrorEnvelope, SuccessEnvelope } from '../support/response-envelope';
import { mockUpstream } from '../support/upstream-mock';

const validUserPayload = {
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'sincere@april.biz',
  address: {
    street: 'Kulas Light',
    suite: 'Apt. 556',
    city: 'Gwenborough',
    zipcode: '92998-3874',
    geo: { lat: '-37.3159', lng: '81.1496' },
  },
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  company: {
    name: 'Romaguera-Crona',
    catchPhrase: 'Multi-layered client-server neural-net',
    bs: 'harness real-time e-markets',
  },
};

describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /users', () => {
    it('returns the list of users from upstream', async () => {
      const users = [{ id: 1, ...validUserPayload }];
      mockUpstream().get('/users').reply(200, users);

      const response = await api(app).get('/users').expect(200);

      const body = response.body as SuccessEnvelope<User[]>;
      expect(body.data).toEqual(users);
    });

    it('forwards ?username= as an upstream query param', async () => {
      const users = [{ id: 1, ...validUserPayload }];
      mockUpstream()
        .get('/users')
        .query({ username: 'Bret' })
        .reply(200, users);

      const response = await api(app).get('/users?username=Bret').expect(200);

      const body = response.body as SuccessEnvelope<User[]>;
      expect(body.data).toEqual(users);
    });

    it('forwards ?email= as an upstream query param', async () => {
      const users = [{ id: 1, ...validUserPayload }];
      mockUpstream()
        .get('/users')
        .query({ email: 'sincere@april.biz' })
        .reply(200, users);

      const response = await api(app)
        .get('/users?email=sincere@april.biz')
        .expect(200);

      const body = response.body as SuccessEnvelope<User[]>;
      expect(body.data).toEqual(users);
    });

    it('rejects a malformed email with 400', async () => {
      await api(app).get('/users?email=not-an-email').expect(400);
    });
  });

  describe('GET /users/:id', () => {
    it('returns a single user from upstream', async () => {
      const user = { id: 1, ...validUserPayload };
      mockUpstream().get('/users/1').reply(200, user);

      const response = await api(app).get('/users/1').expect(200);

      const body = response.body as SuccessEnvelope<User>;
      expect(body.data).toEqual(user);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await api(app).get('/users/abc').expect(400);
    });
  });

  describe('POST /users', () => {
    it('creates a user and returns the upstream response', async () => {
      const created = { id: 11, ...validUserPayload };
      mockUpstream().post('/users', validUserPayload).reply(201, created);

      const response = await api(app)
        .post('/users')
        .send(validUserPayload)
        .expect(201);

      const body = response.body as SuccessEnvelope<User>;
      expect(body.data).toEqual(created);
    });

    it('rejects a payload missing the nested address with 400', async () => {
      const { address, ...withoutAddress } = validUserPayload;
      void address;

      const response = await api(app)
        .post('/users')
        .send(withoutAddress)
        .expect(400);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });

    it('rejects an invalid nested geo coordinate with 400', async () => {
      const invalidPayload = {
        ...validUserPayload,
        address: {
          ...validUserPayload.address,
          geo: { lat: 'not-a-latitude', lng: '81.1496' },
        },
      };

      await api(app).post('/users').send(invalidPayload).expect(400);
    });

    it('rejects an out-of-range latitude with 400', async () => {
      const invalidPayload = {
        ...validUserPayload,
        address: {
          ...validUserPayload.address,
          geo: { lat: '91', lng: '81.1496' },
        },
      };

      await api(app).post('/users').send(invalidPayload).expect(400);
    });

    it('rejects an unknown key inside address.geo with 400', async () => {
      const invalidPayload = {
        ...validUserPayload,
        address: {
          ...validUserPayload.address,
          geo: { ...validUserPayload.address.geo, altitude: '10' },
        },
      };

      await api(app).post('/users').send(invalidPayload).expect(400);
    });

    it('rejects an unknown top-level property with 400', async () => {
      await api(app)
        .post('/users')
        .send({ ...validUserPayload, extra: 'nope' })
        .expect(400);
    });
  });

  describe('PUT /users/:id', () => {
    it('replaces a user and returns the upstream response', async () => {
      const updated = { id: 1, ...validUserPayload };
      mockUpstream().put('/users/1', validUserPayload).reply(200, updated);

      const response = await api(app)
        .put('/users/1')
        .send(validUserPayload)
        .expect(200);

      const body = response.body as SuccessEnvelope<User>;
      expect(body.data).toEqual(updated);
    });

    it('rejects a partial body with 400 (PUT replaces, it does not merge)', async () => {
      await api(app).put('/users/1').send({ name: 'only a name' }).expect(400);
    });
  });

  describe('PATCH /users/:id', () => {
    it('partially updates a user and returns the upstream response', async () => {
      const dto = { name: 'patched name' };
      const patched = { id: 1, ...validUserPayload, name: 'patched name' };
      mockUpstream().patch('/users/1', dto).reply(200, patched);

      const response = await api(app).patch('/users/1').send(dto).expect(200);

      const body = response.body as SuccessEnvelope<User>;
      expect(body.data).toEqual(patched);
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes a user and returns the upstream response', async () => {
      mockUpstream().delete('/users/1').reply(200, {});

      const response = await api(app).delete('/users/1').expect(200);

      const body = response.body as SuccessEnvelope<object>;
      expect(body.data).toEqual({});
    });
  });

  describe('GET /users/:id/posts', () => {
    it('returns the posts belonging to the user', async () => {
      const posts = [{ id: 1, userId: 1, title: 't', body: 'b' }];
      mockUpstream().get('/posts').query({ userId: '1' }).reply(200, posts);

      const response = await api(app).get('/users/1/posts').expect(200);

      const body = response.body as SuccessEnvelope<Post[]>;
      expect(body.data).toEqual(posts);
    });
  });

  describe('GET /users/:id/todos', () => {
    it('returns the todos belonging to the user', async () => {
      const todos = [{ id: 1, userId: 1, title: 't', completed: false }];
      mockUpstream().get('/todos').query({ userId: '1' }).reply(200, todos);

      const response = await api(app).get('/users/1/todos').expect(200);

      const body = response.body as SuccessEnvelope<Todo[]>;
      expect(body.data).toEqual(todos);
    });
  });

  describe('GET /users/:id/albums', () => {
    it('returns the albums belonging to the user', async () => {
      const albums = [{ id: 1, userId: 1, title: 't' }];
      mockUpstream().get('/albums').query({ userId: '1' }).reply(200, albums);

      const response = await api(app).get('/users/1/albums').expect(200);

      const body = response.body as SuccessEnvelope<Album[]>;
      expect(body.data).toEqual(albums);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await api(app).get('/users/abc/albums').expect(400);
    });
  });
});
