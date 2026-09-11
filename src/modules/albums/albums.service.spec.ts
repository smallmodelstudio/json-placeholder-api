import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamService } from '../../upstream/upstream.service';
import { PhotosService } from '../photos/photos.service';
import { Photo } from '../photos/entities/photo.entity';
import { AlbumsService } from './albums.service';
import { Album } from './entities/album.entity';

describe('AlbumsService', () => {
  let service: AlbumsService;
  let upstream: {
    get: Mock;
    post: Mock;
    put: Mock;
    patch: Mock;
    delete: Mock;
  };
  let photosService: { findAll: Mock };

  beforeEach(async () => {
    upstream = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };
    photosService = { findAll: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlbumsService,
        { provide: UpstreamService, useValue: upstream },
        { provide: PhotosService, useValue: photosService },
      ],
    }).compile();

    service = module.get(AlbumsService);
  });

  describe('findAll', () => {
    it('calls the upstream albums endpoint with no params when userId is absent', async () => {
      const albums: Album[] = [{ id: 1, userId: 1, title: 't' }];
      upstream.get.mockResolvedValueOnce(albums);

      const result = await service.findAll({});

      expect(result).toBe(albums);
      expect(upstream.get).toHaveBeenCalledWith('/albums', {
        params: undefined,
      });
    });

    it('forwards userId as a query param when provided', async () => {
      upstream.get.mockResolvedValueOnce([]);

      await service.findAll({ userId: 7 });

      expect(upstream.get).toHaveBeenCalledWith('/albums', {
        params: { userId: 7 },
      });
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findAll({})).rejects.toThrow(error);
    });
  });

  describe('findOne', () => {
    it('calls the upstream endpoint for a single album by id', async () => {
      const album: Album = { id: 5, userId: 1, title: 't' };
      upstream.get.mockResolvedValueOnce(album);

      const result = await service.findOne(5);

      expect(result).toBe(album);
      expect(upstream.get).toHaveBeenCalledWith('/albums/5');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('not found');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findOne(999)).rejects.toThrow(error);
    });
  });

  describe('create', () => {
    it('posts the dto to the upstream albums endpoint', async () => {
      const dto = { userId: 1, title: 't' };
      const created: Album = { id: 101, ...dto };
      upstream.post.mockResolvedValueOnce(created);

      const result = await service.create(dto);

      expect(result).toBe(created);
      expect(upstream.post).toHaveBeenCalledWith('/albums', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.post.mockRejectedValueOnce(error);

      await expect(service.create({ userId: 1, title: 't' })).rejects.toThrow(
        error,
      );
    });
  });

  describe('update', () => {
    it('puts the dto to the upstream endpoint for the given id', async () => {
      const dto = { userId: 1, title: 't' };
      const updated: Album = { id: 1, ...dto };
      upstream.put.mockResolvedValueOnce(updated);

      const result = await service.update(1, dto);

      expect(result).toBe(updated);
      expect(upstream.put).toHaveBeenCalledWith('/albums/1', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.put.mockRejectedValueOnce(error);

      await expect(
        service.update(1, { userId: 1, title: 't' }),
      ).rejects.toThrow(error);
    });
  });

  describe('patch', () => {
    it('patches the dto to the upstream endpoint for the given id', async () => {
      const dto = { title: 'new title' };
      const patched: Album = { id: 1, userId: 1, title: 'new title' };
      upstream.patch.mockResolvedValueOnce(patched);

      const result = await service.patch(1, dto);

      expect(result).toBe(patched);
      expect(upstream.patch).toHaveBeenCalledWith('/albums/1', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.patch.mockRejectedValueOnce(error);

      await expect(service.patch(1, {})).rejects.toThrow(error);
    });
  });

  describe('remove', () => {
    it('deletes the upstream endpoint for the given id', async () => {
      upstream.delete.mockResolvedValueOnce({});

      const result = await service.remove(1);

      expect(result).toEqual({});
      expect(upstream.delete).toHaveBeenCalledWith('/albums/1');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.delete.mockRejectedValueOnce(error);

      await expect(service.remove(999)).rejects.toThrow(error);
    });
  });

  describe('findPhotos', () => {
    it('delegates to PhotosService.findAll with the albumId filter', async () => {
      const photos: Photo[] = [
        {
          id: 1,
          albumId: 1,
          title: 't',
          url: 'https://x/1',
          thumbnailUrl: 'https://x/1t',
        },
      ];
      photosService.findAll.mockResolvedValueOnce(photos);

      const result = await service.findPhotos(1);

      expect(result).toBe(photos);
      expect(photosService.findAll).toHaveBeenCalledWith({ albumId: 1 });
    });

    it('propagates errors from PhotosService', async () => {
      const error = new Error('upstream failure');
      photosService.findAll.mockRejectedValueOnce(error);

      await expect(service.findPhotos(1)).rejects.toThrow(error);
    });
  });
});
