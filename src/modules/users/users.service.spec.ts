import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamService } from '../../upstream/upstream.service';
import { AlbumsService } from '../albums/albums.service';
import { Album } from '../albums/entities/album.entity';
import { PostsService } from '../posts/posts.service';
import { Post } from '../posts/entities/post.entity';
import { TodosService } from '../todos/todos.service';
import { Todo } from '../todos/entities/todo.entity';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

const userDto = {
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'sincere@april.biz',
  address: {
    street: 'Kulas Light',
    suite: 'Apt. 556',
    city: 'Gwenborough',
    zipcode: '92998-3874',
    geo: { lat: '-37.3159', lng: '81.1496' },
  },
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  company: {
    name: 'Romaguera-Crona',
    catchPhrase: 'Multi-layered client-server neural-net',
    bs: 'harness real-time e-markets',
  },
};

const sampleUser: User = { id: 1, ...userDto };

describe('UsersService', () => {
  let service: UsersService;
  let upstream: {
    get: Mock;
    post: Mock;
    put: Mock;
    patch: Mock;
    delete: Mock;
  };
  let postsService: { findAll: Mock };
  let todosService: { findAll: Mock };
  let albumsService: { findAll: Mock };

  beforeEach(async () => {
    upstream = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };
    postsService = { findAll: vi.fn() };
    todosService = { findAll: vi.fn() };
    albumsService = { findAll: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UpstreamService, useValue: upstream },
        { provide: PostsService, useValue: postsService },
        { provide: TodosService, useValue: todosService },
        { provide: AlbumsService, useValue: albumsService },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findAll', () => {
    it('calls the upstream users endpoint', async () => {
      const users: User[] = [sampleUser];
      upstream.get.mockResolvedValueOnce(users);

      const result = await service.findAll();

      expect(result).toBe(users);
      expect(upstream.get).toHaveBeenCalledWith('/users');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findAll()).rejects.toThrow(error);
    });
  });

  describe('findOne', () => {
    it('calls the upstream endpoint for a single user by id', async () => {
      upstream.get.mockResolvedValueOnce(sampleUser);

      const result = await service.findOne(1);

      expect(result).toBe(sampleUser);
      expect(upstream.get).toHaveBeenCalledWith('/users/1');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('not found');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findOne(999)).rejects.toThrow(error);
    });
  });

  describe('create', () => {
    it('posts the dto to the upstream users endpoint', async () => {
      const created: User = { id: 11, ...userDto };
      upstream.post.mockResolvedValueOnce(created);

      const result = await service.create(userDto);

      expect(result).toBe(created);
      expect(upstream.post).toHaveBeenCalledWith('/users', userDto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.post.mockRejectedValueOnce(error);

      await expect(service.create(userDto)).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    it('puts the dto to the upstream endpoint for the given id', async () => {
      upstream.put.mockResolvedValueOnce(sampleUser);

      const result = await service.update(1, userDto);

      expect(result).toBe(sampleUser);
      expect(upstream.put).toHaveBeenCalledWith('/users/1', userDto);
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
      const patched: User = { ...sampleUser, name: 'new name' };
      upstream.patch.mockResolvedValueOnce(patched);

      const result = await service.patch(1, dto);

      expect(result).toBe(patched);
      expect(upstream.patch).toHaveBeenCalledWith('/users/1', dto);
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
      expect(upstream.delete).toHaveBeenCalledWith('/users/1');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.delete.mockRejectedValueOnce(error);

      await expect(service.remove(999)).rejects.toThrow(error);
    });
  });

  describe('findPosts', () => {
    it('delegates to PostsService.findAll with the userId filter', async () => {
      const posts: Post[] = [{ id: 1, userId: 1, title: 't', body: 'b' }];
      postsService.findAll.mockResolvedValueOnce(posts);

      const result = await service.findPosts(1);

      expect(result).toBe(posts);
      expect(postsService.findAll).toHaveBeenCalledWith({ userId: 1 });
    });

    it('propagates errors from PostsService', async () => {
      const error = new Error('upstream failure');
      postsService.findAll.mockRejectedValueOnce(error);

      await expect(service.findPosts(1)).rejects.toThrow(error);
    });
  });

  describe('findTodos', () => {
    it('delegates to TodosService.findAll with the userId filter', async () => {
      const todos: Todo[] = [
        { id: 1, userId: 1, title: 't', completed: false },
      ];
      todosService.findAll.mockResolvedValueOnce(todos);

      const result = await service.findTodos(1);

      expect(result).toBe(todos);
      expect(todosService.findAll).toHaveBeenCalledWith({ userId: 1 });
    });

    it('propagates errors from TodosService', async () => {
      const error = new Error('upstream failure');
      todosService.findAll.mockRejectedValueOnce(error);

      await expect(service.findTodos(1)).rejects.toThrow(error);
    });
  });

  describe('findAlbums', () => {
    it('delegates to AlbumsService.findAll with the userId filter', async () => {
      const albums: Album[] = [{ id: 1, userId: 1, title: 't' }];
      albumsService.findAll.mockResolvedValueOnce(albums);

      const result = await service.findAlbums(1);

      expect(result).toBe(albums);
      expect(albumsService.findAll).toHaveBeenCalledWith({ userId: 1 });
    });

    it('propagates errors from AlbumsService', async () => {
      const error = new Error('upstream failure');
      albumsService.findAll.mockRejectedValueOnce(error);

      await expect(service.findAlbums(1)).rejects.toThrow(error);
    });
  });
});
