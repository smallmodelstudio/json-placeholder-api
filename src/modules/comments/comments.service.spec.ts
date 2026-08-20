import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamService } from '../../upstream/upstream.service';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

describe('CommentsService', () => {
  let service: CommentsService;
  let upstream: {
    get: jest.Mock;
    post: jest.Mock;
    put: jest.Mock;
    patch: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    upstream = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: UpstreamService, useValue: upstream },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  describe('findAll', () => {
    it('calls the upstream comments endpoint with no params when postId is absent', async () => {
      const comments: Comment[] = [
        { id: 1, postId: 1, name: 'n', email: 'e@example.com', body: 'b' },
      ];
      upstream.get.mockResolvedValueOnce(comments);

      const result = await service.findAll({});

      expect(result).toBe(comments);
      expect(upstream.get).toHaveBeenCalledWith('/comments', {
        params: undefined,
      });
    });

    it('forwards postId as a query param when provided', async () => {
      upstream.get.mockResolvedValueOnce([]);

      await service.findAll({ postId: 7 });

      expect(upstream.get).toHaveBeenCalledWith('/comments', {
        params: { postId: 7 },
      });
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findAll({})).rejects.toThrow(error);
    });
  });

  describe('findOne', () => {
    it('calls the upstream endpoint for a single comment by id', async () => {
      const comment: Comment = {
        id: 5,
        postId: 1,
        name: 'n',
        email: 'e@example.com',
        body: 'b',
      };
      upstream.get.mockResolvedValueOnce(comment);

      const result = await service.findOne(5);

      expect(result).toBe(comment);
      expect(upstream.get).toHaveBeenCalledWith('/comments/5');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('not found');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findOne(999)).rejects.toThrow(error);
    });
  });

  describe('create', () => {
    it('posts the dto to the upstream comments endpoint', async () => {
      const dto = { postId: 1, name: 'n', email: 'e@example.com', body: 'b' };
      const created: Comment = { id: 101, ...dto };
      upstream.post.mockResolvedValueOnce(created);

      const result = await service.create(dto);

      expect(result).toBe(created);
      expect(upstream.post).toHaveBeenCalledWith('/comments', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.post.mockRejectedValueOnce(error);

      await expect(
        service.create({
          postId: 1,
          name: 'n',
          email: 'e@example.com',
          body: 'b',
        }),
      ).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    it('puts the dto to the upstream endpoint for the given id', async () => {
      const dto = { postId: 1, name: 'n', email: 'e@example.com', body: 'b' };
      const updated: Comment = { id: 1, ...dto };
      upstream.put.mockResolvedValueOnce(updated);

      const result = await service.update(1, dto);

      expect(result).toBe(updated);
      expect(upstream.put).toHaveBeenCalledWith('/comments/1', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.put.mockRejectedValueOnce(error);

      await expect(service.update(1, {})).rejects.toThrow(error);
    });
  });

  describe('patch', () => {
    it('patches the dto to the upstream endpoint for the given id', async () => {
      const dto = { name: 'new name' };
      const patched: Comment = {
        id: 1,
        postId: 1,
        name: 'new name',
        email: 'e@example.com',
        body: 'b',
      };
      upstream.patch.mockResolvedValueOnce(patched);

      const result = await service.patch(1, dto);

      expect(result).toBe(patched);
      expect(upstream.patch).toHaveBeenCalledWith('/comments/1', dto);
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
      expect(upstream.delete).toHaveBeenCalledWith('/comments/1');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.delete.mockRejectedValueOnce(error);

      await expect(service.remove(999)).rejects.toThrow(error);
    });
  });
});
