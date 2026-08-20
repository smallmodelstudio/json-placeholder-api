import { Test, TestingModule } from '@nestjs/testing';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';

describe('PostsController', () => {
  let controller: PostsController;
  let service: { findAll: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn(), findOne: jest.fn() };

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
});
