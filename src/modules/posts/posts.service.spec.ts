import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamService } from '../../upstream/upstream.service';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';

describe('PostsService', () => {
  let service: PostsService;
  let upstream: { get: jest.Mock };

  beforeEach(async () => {
    upstream = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: UpstreamService, useValue: upstream },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  describe('findAll', () => {
    it('calls the upstream posts endpoint with no params when userId is absent', async () => {
      const posts: Post[] = [{ id: 1, userId: 1, title: 't', body: 'b' }];
      upstream.get.mockResolvedValueOnce(posts);

      const result = await service.findAll({});

      expect(result).toBe(posts);
      expect(upstream.get).toHaveBeenCalledWith('/posts', {
        params: undefined,
      });
    });

    it('forwards userId as a query param when provided', async () => {
      upstream.get.mockResolvedValueOnce([]);

      await service.findAll({ userId: 7 });

      expect(upstream.get).toHaveBeenCalledWith('/posts', {
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
    it('calls the upstream endpoint for a single post by id', async () => {
      const post: Post = { id: 5, userId: 1, title: 't', body: 'b' };
      upstream.get.mockResolvedValueOnce(post);

      const result = await service.findOne(5);

      expect(result).toBe(post);
      expect(upstream.get).toHaveBeenCalledWith('/posts/5');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('not found');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findOne(999)).rejects.toThrow(error);
    });
  });
});
