import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamService } from '../../upstream/upstream.service';
import { PhotosService } from './photos.service';
import { Photo } from './entities/photo.entity';

describe('PhotosService', () => {
  let service: PhotosService;
  let upstream: {
    get: Mock;
    post: Mock;
    put: Mock;
    patch: Mock;
    delete: Mock;
  };

  beforeEach(async () => {
    upstream = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: UpstreamService, useValue: upstream },
      ],
    }).compile();

    service = module.get(PhotosService);
  });

  describe('findAll', () => {
    it('calls the upstream photos endpoint with no params when albumId is absent', async () => {
      const photos: Photo[] = [
        {
          id: 1,
          albumId: 1,
          title: 't',
          url: 'https://x/1',
          thumbnailUrl: 'https://x/1t',
        },
      ];
      upstream.get.mockResolvedValueOnce(photos);

      const result = await service.findAll({});

      expect(result).toBe(photos);
      expect(upstream.get).toHaveBeenCalledWith('/photos', {
        params: undefined,
      });
    });

    it('forwards albumId as a query param when provided', async () => {
      upstream.get.mockResolvedValueOnce([]);

      await service.findAll({ albumId: 7 });

      expect(upstream.get).toHaveBeenCalledWith('/photos', {
        params: { albumId: 7 },
      });
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findAll({})).rejects.toThrow(error);
    });
  });

  describe('findOne', () => {
    it('calls the upstream endpoint for a single photo by id', async () => {
      const photo: Photo = {
        id: 5,
        albumId: 1,
        title: 't',
        url: 'https://x/5',
        thumbnailUrl: 'https://x/5t',
      };
      upstream.get.mockResolvedValueOnce(photo);

      const result = await service.findOne(5);

      expect(result).toBe(photo);
      expect(upstream.get).toHaveBeenCalledWith('/photos/5');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('not found');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findOne(999)).rejects.toThrow(error);
    });
  });

  describe('create', () => {
    it('posts the dto to the upstream photos endpoint', async () => {
      const dto = {
        albumId: 1,
        title: 't',
        url: 'https://x/1',
        thumbnailUrl: 'https://x/1t',
      };
      const created: Photo = { id: 101, ...dto };
      upstream.post.mockResolvedValueOnce(created);

      const result = await service.create(dto);

      expect(result).toBe(created);
      expect(upstream.post).toHaveBeenCalledWith('/photos', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.post.mockRejectedValueOnce(error);

      await expect(
        service.create({
          albumId: 1,
          title: 't',
          url: 'https://x/1',
          thumbnailUrl: 'https://x/1t',
        }),
      ).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    it('puts the dto to the upstream endpoint for the given id', async () => {
      const dto = {
        albumId: 1,
        title: 't',
        url: 'https://x/1',
        thumbnailUrl: 'https://x/1t',
      };
      const updated: Photo = { id: 1, ...dto };
      upstream.put.mockResolvedValueOnce(updated);

      const result = await service.update(1, dto);

      expect(result).toBe(updated);
      expect(upstream.put).toHaveBeenCalledWith('/photos/1', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.put.mockRejectedValueOnce(error);

      await expect(
        service.update(1, {
          albumId: 1,
          title: 't',
          url: 'https://x/1',
          thumbnailUrl: 'https://x/1t',
        }),
      ).rejects.toThrow(error);
    });
  });

  describe('patch', () => {
    it('patches the dto to the upstream endpoint for the given id', async () => {
      const dto = { title: 'new title' };
      const patched: Photo = {
        id: 1,
        albumId: 1,
        title: 'new title',
        url: 'https://x/1',
        thumbnailUrl: 'https://x/1t',
      };
      upstream.patch.mockResolvedValueOnce(patched);

      const result = await service.patch(1, dto);

      expect(result).toBe(patched);
      expect(upstream.patch).toHaveBeenCalledWith('/photos/1', dto);
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
      expect(upstream.delete).toHaveBeenCalledWith('/photos/1');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.delete.mockRejectedValueOnce(error);

      await expect(service.remove(999)).rejects.toThrow(error);
    });
  });
});
