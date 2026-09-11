import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Album } from '../../src/modules/albums/entities/album.entity';
import { Photo } from '../../src/modules/photos/entities/photo.entity';
import { api } from '../support/api';
import { createTestApp } from '../support/create-test-app';
import { ErrorEnvelope, SuccessEnvelope } from '../support/response-envelope';
import { mockUpstream } from '../support/upstream-mock';

describe('Albums (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /albums', () => {
    it('returns the list of albums from upstream', async () => {
      const albums = [{ id: 1, userId: 1, title: 't' }];
      mockUpstream().get('/albums').reply(200, albums);

      const response = await api(app).get('/albums').expect(200);

      const body = response.body as SuccessEnvelope<Album[]>;
      expect(body.data).toEqual(albums);
    });

    it('forwards ?userId= as an upstream query param', async () => {
      const albums = [{ id: 1, userId: 7, title: 't' }];
      mockUpstream().get('/albums').query({ userId: '7' }).reply(200, albums);

      const response = await api(app).get('/albums?userId=7').expect(200);

      const body = response.body as SuccessEnvelope<Album[]>;
      expect(body.data).toEqual(albums);
    });
  });

  describe('GET /albums/:id', () => {
    it('returns a single album from upstream', async () => {
      const album = { id: 1, userId: 1, title: 't' };
      mockUpstream().get('/albums/1').reply(200, album);

      const response = await api(app).get('/albums/1').expect(200);

      const body = response.body as SuccessEnvelope<Album>;
      expect(body.data).toEqual(album);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await api(app).get('/albums/abc').expect(400);
    });
  });

  describe('POST /albums', () => {
    it('creates an album and returns the upstream response', async () => {
      const dto = { userId: 1, title: 't' };
      const created = { id: 101, ...dto };
      mockUpstream().post('/albums', dto).reply(201, created);

      const response = await api(app).post('/albums').send(dto).expect(201);

      const body = response.body as SuccessEnvelope<Album>;
      expect(body.data).toEqual(created);
    });

    it('rejects a payload missing the title with 400', async () => {
      const response = await api(app)
        .post('/albums')
        .send({ userId: 1 })
        .expect(400);

      const body = response.body as ErrorEnvelope;
      expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });
  });

  describe('PUT /albums/:id', () => {
    it('replaces an album and returns the upstream response', async () => {
      const dto = { userId: 1, title: 'replaced' };
      const updated = { id: 1, ...dto };
      mockUpstream().put('/albums/1', dto).reply(200, updated);

      const response = await api(app).put('/albums/1').send(dto).expect(200);

      const body = response.body as SuccessEnvelope<Album>;
      expect(body.data).toEqual(updated);
    });
  });

  describe('PATCH /albums/:id', () => {
    it('partially updates an album and returns the upstream response', async () => {
      const dto = { title: 'patched' };
      const patched = { id: 1, userId: 1, title: 'patched' };
      mockUpstream().patch('/albums/1', dto).reply(200, patched);

      const response = await api(app).patch('/albums/1').send(dto).expect(200);

      const body = response.body as SuccessEnvelope<Album>;
      expect(body.data).toEqual(patched);
    });
  });

  describe('DELETE /albums/:id', () => {
    it('deletes an album and returns the upstream response', async () => {
      mockUpstream().delete('/albums/1').reply(200, {});

      const response = await api(app).delete('/albums/1').expect(200);

      const body = response.body as SuccessEnvelope<object>;
      expect(body.data).toEqual({});
    });
  });

  describe('GET /albums/:id/photos', () => {
    it('returns the photos belonging to the album', async () => {
      const photos = [
        {
          id: 1,
          albumId: 1,
          title: 't',
          url: 'https://via.placeholder.com/600/1',
          thumbnailUrl: 'https://via.placeholder.com/150/1',
        },
      ];
      mockUpstream().get('/photos').query({ albumId: '1' }).reply(200, photos);

      const response = await api(app).get('/albums/1/photos').expect(200);

      const body = response.body as SuccessEnvelope<Photo[]>;
      expect(body.data).toEqual(photos);
    });

    it('rejects a non-positive-integer id with 400', async () => {
      await api(app).get('/albums/abc/photos').expect(400);
    });
  });
});
