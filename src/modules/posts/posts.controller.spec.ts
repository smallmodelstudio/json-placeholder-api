import { Test, TestingModule } from '@nestjs/testing';
import { Comment } from '../comments/entities/comment.entity';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';

describe('PostsController', () => {
  let controller: PostsController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    patch: jest.Mock;
    remove: jest.Mock;
    findComments: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      patch: jest.fn(),
      remove: jest.fn(),
      findComments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: service }],
    }).compile();

    controller = module.get(PostsController);
  });

  describe('findAll', () => {
    it('delegates to PostsService.findAll with the query dto', async () => {
      const posts: Post[] = [{ id: 1, userId: 1, title: 't', body: 'b' }];
      service.findAll.mockResolvedValueOnce(posts);

      const result = await controller.findAll({ userId: 1 });

      expect(result).toBe(posts);
      expect(service.findAll).toHaveBeenCalledWith({ userId: 1 });
    });
  });

  describe('findOne', () => {
    it('delegates to PostsService.findOne with the parsed id', async () => {
      const post: Post = { id: 5, userId: 1, title: 't', body: 'b' };
      service.findOne.mockResolvedValueOnce(post);

      const result = await controller.findOne(5);

      expect(result).toBe(post);
      expect(service.findOne).toHaveBeenCalledWith(5);
    });
  });

  describe('create', () => {
    it('delegates to PostsService.create with the body dto', async () => {
      const dto = { title: 't', body: 'b', userId: 1 };
      const created: Post = { id: 101, ...dto };
      service.create.mockResolvedValueOnce(created);

      const result = await controller.create(dto);

      expect(result).toBe(created);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('delegates to PostsService.update with the parsed id and body dto', async () => {
      const dto = { title: 't', body: 'b', userId: 1 };
      const updated: Post = { id: 5, ...dto };
      service.update.mockResolvedValueOnce(updated);

      const result = await controller.update(5, dto);

      expect(result).toBe(updated);
      expect(service.update).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('patch', () => {
    it('delegates to PostsService.patch with the parsed id and body dto', async () => {
      const dto = { title: 'new title' };
      const patched: Post = { id: 5, userId: 1, title: 'new title', body: 'b' };
      service.patch.mockResolvedValueOnce(patched);

      const result = await controller.patch(5, dto);

      expect(result).toBe(patched);
      expect(service.patch).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('remove', () => {
    it('delegates to PostsService.remove with the parsed id', async () => {
      service.remove.mockResolvedValueOnce({});

      const result = await controller.remove(5);

      expect(result).toEqual({});
      expect(service.remove).toHaveBeenCalledWith(5);
    });
  });

  describe('findComments', () => {
    it('delegates to PostsService.findComments with the parsed id', async () => {
      const comments: Comment[] = [
        { id: 1, postId: 5, name: 'n', email: 'e@example.com', body: 'b' },
      ];
      service.findComments.mockResolvedValueOnce(comments);

      const result = await controller.findComments(5);

      expect(result).toBe(comments);
      expect(service.findComments).toHaveBeenCalledWith(5);
    });
  });
});
