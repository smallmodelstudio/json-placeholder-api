import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Photo } from '../../src/modules/photos/entities/photo.entity';
import { api } from '../support/api';
import { createTestApp } from '../support/create-test-app';
import { ErrorEnvelope, SuccessEnvelope } from '../support/response-envelope';
import { mockUpstream } from '../support/upstream-mock';

describe('Photos (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /photos', () => {
    it('returns the list of photos from upstream', async () => {
      const photos = [
        {
          id: 1,
          albumId: 1,
          title: 't',
          url: 'https://via.placeholder.com/600/1',
          thumbnailUrl: 'https://via.placeholder.com/150/1',
        },
      ];
      mockUpstream().get('/photos').reply(200, photos);

      const response = await api(app).get('/photos').expect(200);

      const body = response.body as SuccessEnvelope<Photo[]>;
      expect(body.data).toEqual(photos);
    });

    it('forwards ?albumId= as an upstream query param', async () => {
      const photos = [
        {
          id: 1,
          albumId: 7,
          title: 't',
          url: 'https://via.placeholder.com/600/1',
          thumbnailUrl: 'https://via.placeholder.com/150/1',
        },
      ];
      mockUpstream().get('/photos').query({ albumId: '7' }).reply(200, photos);

      const response = await api(app).get('/photos?albumId=7').expect(200);

      const body = response.body as SuccessEnvelope<Photo[]>;
      expect(body.data).toEqual(photos);
    });
  });

  describe('GET /photos/:id', () => {
    it('returns a single photo from upstream', async () => {
      const photo = {
        id: 1,
        albumId: 1,
        title: 't',
        url: 'https://via.placeholder.com/600/1',
        thumbnailUrl: 'https://via.placeholder.com/150/1',
      };
      mockUpstream().get('/photos/1').reply(200, photo);

      const response = await api(app).get('/photos/1').expect(200);

      const body = response.body as SuccessEnvelope<Photo>;
      expect(body.data).toEqual(photo);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await api(app).get('/photos/abc').expect(400);
    });
  });

  describe('POST /photos', () => {
    it('creates a photo and returns the upstream response', async () => {
      const dto = {
        albumId: 1,
        title: 't',
        url: 'https://via.placeholder.com/600/1',
        thumbnailUrl: 'https://via.placeholder.com/150/1',
      };
      const created = { id: 5001, ...dto };
      mockUpstream().post('/photos', dto).reply(201, created);

      const response = await api(app).post('/photos').send(dto).expect(201);

      const body = response.body as SuccessEnvelope<Photo>;
      expect(body.data).toEqual(created);
    });

    it('rejects a non-url value with 400', async () => {
      const response = await api(app)
        .post('/photos')
        .send({
          albumId: 1,
          title: 't',
          url: 'not-a-url',
          thumbnailUrl: 'https://via.placeholder.com/150/1',
        })
        .expect(400);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });
  });

  describe('PUT /photos/:id', () => {
    it('replaces a photo and returns the upstream response', async () => {
      const dto = {
        albumId: 1,
        title: 'replaced',
        url: 'https://via.placeholder.com/600/1',
        thumbnailUrl: 'https://via.placeholder.com/150/1',
      };
      const updated = { id: 1, ...dto };
      mockUpstream().put('/photos/1', dto).reply(200, updated);

      const response = await api(app).put('/photos/1').send(dto).expect(200);

      const body = response.body as SuccessEnvelope<Photo>;
      expect(body.data).toEqual(updated);
    });
  });

  describe('PATCH /photos/:id', () => {
    it('partially updates a photo and returns the upstream response', async () => {
      const dto = { title: 'patched' };
      const patched = {
        id: 1,
        albumId: 1,
        title: 'patched',
        url: 'https://via.placeholder.com/600/1',
        thumbnailUrl: 'https://via.placeholder.com/150/1',
      };
      mockUpstream().patch('/photos/1', dto).reply(200, patched);

      const response = await api(app).patch('/photos/1').send(dto).expect(200);

      const body = response.body as SuccessEnvelope<Photo>;
      expect(body.data).toEqual(patched);
    });
  });

  describe('DELETE /photos/:id', () => {
    it('deletes a photo and returns the upstream response', async () => {
      mockUpstream().delete('/photos/1').reply(200, {});

      const response = await api(app).delete('/photos/1').expect(200);

      const body = response.body as SuccessEnvelope<object>;
      expect(body.data).toEqual({});
    });
  });
});
