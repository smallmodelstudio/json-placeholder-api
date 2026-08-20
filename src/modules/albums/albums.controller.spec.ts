import { Test, TestingModule } from '@nestjs/testing';
import { Photo } from '../photos/entities/photo.entity';
import { AlbumsController } from './albums.controller';
import { AlbumsService } from './albums.service';
import { Album } from './entities/album.entity';

describe('AlbumsController', () => {
  let controller: AlbumsController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    patch: jest.Mock;
    remove: jest.Mock;
    findPhotos: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      patch: jest.fn(),
      remove: jest.fn(),
      findPhotos: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlbumsController],
      providers: [{ provide: AlbumsService, useValue: service }],
    }).compile();

    controller = module.get(AlbumsController);
  });

  describe('findAll', () => {
    it('delegates to AlbumsService.findAll with the query dto', async () => {
      const albums: Album[] = [{ id: 1, userId: 1, title: 't' }];
      service.findAll.mockResolvedValueOnce(albums);

      const result = await controller.findAll({ userId: 1 });

      expect(result).toBe(albums);
      expect(service.findAll).toHaveBeenCalledWith({ userId: 1 });
    });
  });

  describe('findOne', () => {
    it('delegates to AlbumsService.findOne with the parsed id', async () => {
      const album: Album = { id: 5, userId: 1, title: 't' };
      service.findOne.mockResolvedValueOnce(album);

      const result = await controller.findOne(5);

      expect(result).toBe(album);
      expect(service.findOne).toHaveBeenCalledWith(5);
    });
  });

  describe('create', () => {
    it('delegates to AlbumsService.create with the body dto', async () => {
      const dto = { userId: 1, title: 't' };
      const created: Album = { id: 101, ...dto };
      service.create.mockResolvedValueOnce(created);

      const result = await controller.create(dto);

      expect(result).toBe(created);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('delegates to AlbumsService.update with the parsed id and body dto', async () => {
      const dto = { userId: 1, title: 't' };
      const updated: Album = { id: 5, ...dto };
      service.update.mockResolvedValueOnce(updated);

      const result = await controller.update(5, dto);

      expect(result).toBe(updated);
      expect(service.update).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('patch', () => {
    it('delegates to AlbumsService.patch with the parsed id and body dto', async () => {
      const dto = { title: 'new title' };
      const patched: Album = { id: 5, userId: 1, title: 'new title' };
      service.patch.mockResolvedValueOnce(patched);

      const result = await controller.patch(5, dto);

      expect(result).toBe(patched);
      expect(service.patch).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('remove', () => {
    it('delegates to AlbumsService.remove with the parsed id', async () => {
      service.remove.mockResolvedValueOnce({});

      const result = await controller.remove(5);

      expect(result).toEqual({});
      expect(service.remove).toHaveBeenCalledWith(5);
    });
  });

  describe('findPhotos', () => {
    it('delegates to AlbumsService.findPhotos with the parsed id', async () => {
      const photos: Photo[] = [
        {
          id: 1,
          albumId: 5,
          title: 't',
          url: 'https://x/1',
          thumbnailUrl: 'https://x/1t',
        },
      ];
      service.findPhotos.mockResolvedValueOnce(photos);

      const result = await controller.findPhotos(5);

      expect(result).toBe(photos);
      expect(service.findPhotos).toHaveBeenCalledWith(5);
    });
  });
});
