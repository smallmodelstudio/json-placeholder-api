import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

describe('CommentsController', () => {
  let controller: CommentsController;
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
      controllers: [CommentsController],
      providers: [{ provide: CommentsService, useValue: service }],
    }).compile();

    controller = module.get(CommentsController);
  });

  describe('findAll', () => {
    it('delegates to CommentsService.findAll with the query dto', async () => {
      const comments: Comment[] = [
        { id: 1, postId: 1, name: 'n', email: 'e@example.com', body: 'b' },
      ];
      service.findAll.mockResolvedValueOnce(comments);

      const result = await controller.findAll({ postId: 1 });

      expect(result).toBe(comments);
      expect(service.findAll).toHaveBeenCalledWith({ postId: 1 });
    });
  });

  describe('findOne', () => {
    it('delegates to CommentsService.findOne with the parsed id', async () => {
      const comment: Comment = {
        id: 5,
        postId: 1,
        name: 'n',
        email: 'e@example.com',
        body: 'b',
      };
      service.findOne.mockResolvedValueOnce(comment);

      const result = await controller.findOne(5);

      expect(result).toBe(comment);
      expect(service.findOne).toHaveBeenCalledWith(5);
    });
  });

  describe('create', () => {
    it('delegates to CommentsService.create with the body dto', async () => {
      const dto = { postId: 1, name: 'n', email: 'e@example.com', body: 'b' };
      const created: Comment = { id: 101, ...dto };
      service.create.mockResolvedValueOnce(created);

      const result = await controller.create(dto);

      expect(result).toBe(created);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('delegates to CommentsService.update with the parsed id and body dto', async () => {
      const dto = { postId: 1, name: 'n', email: 'e@example.com', body: 'b' };
      const updated: Comment = { id: 5, ...dto };
      service.update.mockResolvedValueOnce(updated);

      const result = await controller.update(5, dto);

      expect(result).toBe(updated);
      expect(service.update).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('patch', () => {
    it('delegates to CommentsService.patch with the parsed id and body dto', async () => {
      const dto = { name: 'new name' };
      const patched: Comment = {
        id: 5,
        postId: 1,
        name: 'new name',
        email: 'e@example.com',
        body: 'b',
      };
      service.patch.mockResolvedValueOnce(patched);

      const result = await controller.patch(5, dto);

      expect(result).toBe(patched);
      expect(service.patch).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('remove', () => {
    it('delegates to CommentsService.remove with the parsed id', async () => {
      service.remove.mockResolvedValueOnce({});

      const result = await controller.remove(5);

      expect(result).toEqual({});
      expect(service.remove).toHaveBeenCalledWith(5);
    });
  });
});
