import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamService } from '../../upstream/upstream.service';
import { CommentsService } from '../comments/comments.service';
import { Comment } from '../comments/entities/comment.entity';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';

describe('PostsService', () => {
  let service: PostsService;
  let upstream: {
    get: Mock;
    post: Mock;
    put: Mock;
    patch: Mock;
    delete: Mock;
  };
  let commentsService: { findAll: Mock };

  beforeEach(async () => {
    upstream = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };
    commentsService = { findAll: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: UpstreamService, useValue: upstream },
        { provide: CommentsService, useValue: commentsService },
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

  describe('create', () => {
    it('posts the dto to the upstream posts endpoint', async () => {
      const dto = { title: 't', body: 'b', userId: 1 };
      const created: Post = { id: 101, ...dto };
      upstream.post.mockResolvedValueOnce(created);

      const result = await service.create(dto);

      expect(result).toBe(created);
      expect(upstream.post).toHaveBeenCalledWith('/posts', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.post.mockRejectedValueOnce(error);

      await expect(
        service.create({ title: 't', body: 'b', userId: 1 }),
      ).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    it('puts the dto to the upstream endpoint for the given id', async () => {
      const dto = { title: 't', body: 'b', userId: 1 };
      const updated: Post = { id: 1, ...dto };
      upstream.put.mockResolvedValueOnce(updated);

      const result = await service.update(1, dto);

      expect(result).toBe(updated);
      expect(upstream.put).toHaveBeenCalledWith('/posts/1', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.put.mockRejectedValueOnce(error);

      await expect(
        service.update(1, { title: 't', body: 'b', userId: 1 }),
      ).rejects.toThrow(error);
    });
  });

  describe('patch', () => {
    it('patches the dto to the upstream endpoint for the given id', async () => {
      const dto = { title: 'new title' };
      const patched: Post = { id: 1, userId: 1, title: 'new title', body: 'b' };
      upstream.patch.mockResolvedValueOnce(patched);

      const result = await service.patch(1, dto);

      expect(result).toBe(patched);
      expect(upstream.patch).toHaveBeenCalledWith('/posts/1', dto);
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
      expect(upstream.delete).toHaveBeenCalledWith('/posts/1');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.delete.mockRejectedValueOnce(error);

      await expect(service.remove(999)).rejects.toThrow(error);
    });
  });

  describe('findComments', () => {
    it('delegates to CommentsService.findAll with the postId filter', async () => {
      const comments: Comment[] = [
        { id: 1, postId: 1, name: 'n', email: 'e@example.com', body: 'b' },
      ];
      commentsService.findAll.mockResolvedValueOnce(comments);

      const result = await service.findComments(1);

      expect(result).toBe(comments);
      expect(commentsService.findAll).toHaveBeenCalledWith({ postId: 1 });
    });

    it('propagates errors from CommentsService', async () => {
      const error = new Error('upstream failure');
      commentsService.findAll.mockRejectedValueOnce(error);

      await expect(service.findComments(1)).rejects.toThrow(error);
    });
  });
});
