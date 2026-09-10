import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Todo } from '../../src/modules/todos/entities/todo.entity';
import { createTestApp } from '../support/create-test-app';
import { ErrorEnvelope, SuccessEnvelope } from '../support/response-envelope';
import { mockUpstream } from '../support/upstream-mock';

describe('Todos (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /todos', () => {
    it('returns the list of todos from upstream', async () => {
      const todos = [{ id: 1, userId: 1, title: 't', completed: false }];
      mockUpstream().get('/todos').reply(200, todos);

      const response = await request(app.getHttpServer())
        .get('/todos')
        .expect(200);

      const body = response.body as SuccessEnvelope<Todo[]>;
      expect(body.data).toEqual(todos);
    });

    it('forwards ?userId= as an upstream query param', async () => {
      const todos = [{ id: 1, userId: 7, title: 't', completed: false }];
      mockUpstream().get('/todos').query({ userId: '7' }).reply(200, todos);

      const response = await request(app.getHttpServer())
        .get('/todos?userId=7')
        .expect(200);

      const body = response.body as SuccessEnvelope<Todo[]>;
      expect(body.data).toEqual(todos);
    });
  });

  describe('GET /todos/:id', () => {
    it('returns a single todo from upstream', async () => {
      const todo = { id: 1, userId: 1, title: 't', completed: true };
      mockUpstream().get('/todos/1').reply(200, todo);

      const response = await request(app.getHttpServer())
        .get('/todos/1')
        .expect(200);

      const body = response.body as SuccessEnvelope<Todo>;
      expect(body.data).toEqual(todo);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await request(app.getHttpServer()).get('/todos/abc').expect(400);
    });
  });

  describe('POST /todos', () => {
    it('creates a todo and returns the upstream response', async () => {
      const dto = { userId: 1, title: 't', completed: false };
      const created = { id: 201, ...dto };
      mockUpstream().post('/todos', dto).reply(201, created);

      const response = await request(app.getHttpServer())
        .post('/todos')
        .send(dto)
        .expect(201);

      const body = response.body as SuccessEnvelope<Todo>;
      expect(body.data).toEqual(created);
    });

    it('rejects a payload missing the required completed field with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .send({ userId: 1, title: 't' })
        .expect(400);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });
  });

  describe('PUT /todos/:id', () => {
    it('replaces a todo and returns the upstream response', async () => {
      const dto = { userId: 1, title: 'replaced', completed: true };
      const updated = { id: 1, ...dto };
      mockUpstream().put('/todos/1', dto).reply(200, updated);

      const response = await request(app.getHttpServer())
        .put('/todos/1')
        .send(dto)
        .expect(200);

      const body = response.body as SuccessEnvelope<Todo>;
      expect(body.data).toEqual(updated);
    });
  });

  describe('PATCH /todos/:id', () => {
    it('partially updates a todo and returns the upstream response', async () => {
      const dto = { completed: true };
      const patched = { id: 1, userId: 1, title: 't', completed: true };
      mockUpstream().patch('/todos/1', dto).reply(200, patched);

      const response = await request(app.getHttpServer())
        .patch('/todos/1')
        .send(dto)
        .expect(200);

      const body = response.body as SuccessEnvelope<Todo>;
      expect(body.data).toEqual(patched);
    });
  });

  describe('DELETE /todos/:id', () => {
    it('deletes a todo and returns the upstream response', async () => {
      mockUpstream().delete('/todos/1').reply(200, {});

      const response = await request(app.getHttpServer())
        .delete('/todos/1')
        .expect(200);

      const body = response.body as SuccessEnvelope<object>;
      expect(body.data).toEqual({});
    });
  });
});
