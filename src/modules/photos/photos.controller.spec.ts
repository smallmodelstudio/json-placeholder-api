import { Test, TestingModule } from '@nestjs/testing';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { Photo } from './entities/photo.entity';

describe('PhotosController', () => {
  let controller: PhotosController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    patch: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      patch: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhotosController],
      providers: [{ provide: PhotosService, useValue: service }],
    }).compile();

    controller = module.get(PhotosController);
  });

  describe('findAll', () => {
    it('delegates to PhotosService.findAll with the query dto', async () => {
      const photos: Photo[] = [
        {
          id: 1,
          albumId: 1,
          title: 't',
          url: 'https://x/1',
          thumbnailUrl: 'https://x/1t',
        },
      ];
      service.findAll.mockResolvedValueOnce(photos);

      const result = await controller.findAll({ albumId: 1 });

      expect(result).toBe(photos);
      expect(service.findAll).toHaveBeenCalledWith({ albumId: 1 });
    });
  });

  describe('findOne', () => {
    it('delegates to PhotosService.findOne with the parsed id', async () => {
      const photo: Photo = {
        id: 5,
        albumId: 1,
        title: 't',
        url: 'https://x/5',
        thumbnailUrl: 'https://x/5t',
      };
      service.findOne.mockResolvedValueOnce(photo);

      const result = await controller.findOne(5);

      expect(result).toBe(photo);
      expect(service.findOne).toHaveBeenCalledWith(5);
    });
  });

  describe('create', () => {
    it('delegates to PhotosService.create with the body dto', async () => {
      const dto = {
        albumId: 1,
        title: 't',
        url: 'https://x/1',
        thumbnailUrl: 'https://x/1t',
      };
      const created: Photo = { id: 101, ...dto };
      service.create.mockResolvedValueOnce(created);

      const result = await controller.create(dto);

      expect(result).toBe(created);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('delegates to PhotosService.update with the parsed id and body dto', async () => {
      const dto = {
        albumId: 1,
        title: 't',
        url: 'https://x/1',
        thumbnailUrl: 'https://x/1t',
      };
      const updated: Photo = { id: 5, ...dto };
      service.update.mockResolvedValueOnce(updated);

      const result = await controller.update(5, dto);

      expect(result).toBe(updated);
      expect(service.update).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('patch', () => {
    it('delegates to PhotosService.patch with the parsed id and body dto', async () => {
      const dto = { title: 'new title' };
      const patched: Photo = {
        id: 5,
        albumId: 1,
        title: 'new title',
        url: 'https://x/5',
        thumbnailUrl: 'https://x/5t',
      };
      service.patch.mockResolvedValueOnce(patched);

      const result = await controller.patch(5, dto);

      expect(result).toBe(patched);
      expect(service.patch).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('remove', () => {
    it('delegates to PhotosService.remove with the parsed id', async () => {
      service.remove.mockResolvedValueOnce({});

      const result = await controller.remove(5);

      expect(result).toEqual({});
      expect(service.remove).toHaveBeenCalledWith(5);
    });
  });
});
