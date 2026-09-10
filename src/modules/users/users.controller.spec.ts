import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Album } from '../albums/entities/album.entity';
import { Post } from '../posts/entities/post.entity';
import { Todo } from '../todos/entities/todo.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

const sampleUser: User = {
  id: 1,
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

describe('UsersController', () => {
  let controller: UsersController;
  let service: {
    findAll: Mock;
    findOne: Mock;
    create: Mock;
    update: Mock;
    patch: Mock;
    remove: Mock;
    findPosts: Mock;
    findTodos: Mock;
    findAlbums: Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      patch: vi.fn(),
      remove: vi.fn(),
      findPosts: vi.fn(),
      findTodos: vi.fn(),
      findAlbums: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = module.get(UsersController);
  });

  describe('findAll', () => {
    it('delegates to UsersService.findAll', async () => {
      const users: User[] = [sampleUser];
      service.findAll.mockResolvedValueOnce(users);

      const result = await controller.findAll();

      expect(result).toBe(users);
      expect(service.findAll).toHaveBeenCalledWith();
    });
  });

  describe('findOne', () => {
    it('delegates to UsersService.findOne with the parsed id', async () => {
      service.findOne.mockResolvedValueOnce(sampleUser);

      const result = await controller.findOne(1);

      expect(result).toBe(sampleUser);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('delegates to UsersService.create with the body dto', async () => {
      service.create.mockResolvedValueOnce(sampleUser);

      const result = await controller.create(sampleUser);

      expect(result).toBe(sampleUser);
      expect(service.create).toHaveBeenCalledWith(sampleUser);
    });
  });

  describe('update', () => {
    it('delegates to UsersService.update with the parsed id and body dto', async () => {
      service.update.mockResolvedValueOnce(sampleUser);

      const result = await controller.update(1, sampleUser);

      expect(result).toBe(sampleUser);
      expect(service.update).toHaveBeenCalledWith(1, sampleUser);
    });
  });

  describe('patch', () => {
    it('delegates to UsersService.patch with the parsed id and body dto', async () => {
      const dto = { name: 'new name' };
      const patched: User = { ...sampleUser, name: 'new name' };
      service.patch.mockResolvedValueOnce(patched);

      const result = await controller.patch(1, dto);

      expect(result).toBe(patched);
      expect(service.patch).toHaveBeenCalledWith(1, dto);
    });
  });

  describe('remove', () => {
    it('delegates to UsersService.remove with the parsed id', async () => {
      service.remove.mockResolvedValueOnce({});

      const result = await controller.remove(1);

      expect(result).toEqual({});
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });

  describe('findPosts', () => {
    it('delegates to UsersService.findPosts with the parsed id', async () => {
      const posts: Post[] = [{ id: 1, userId: 1, title: 't', body: 'b' }];
      service.findPosts.mockResolvedValueOnce(posts);

      const result = await controller.findPosts(1);

      expect(result).toBe(posts);
      expect(service.findPosts).toHaveBeenCalledWith(1);
    });
  });

  describe('findTodos', () => {
    it('delegates to UsersService.findTodos with the parsed id', async () => {
      const todos: Todo[] = [
        { id: 1, userId: 1, title: 't', completed: false },
      ];
      service.findTodos.mockResolvedValueOnce(todos);

      const result = await controller.findTodos(1);

      expect(result).toBe(todos);
      expect(service.findTodos).toHaveBeenCalledWith(1);
    });
  });

  describe('findAlbums', () => {
    it('delegates to UsersService.findAlbums with the parsed id', async () => {
      const albums: Album[] = [{ id: 1, userId: 1, title: 't' }];
      service.findAlbums.mockResolvedValueOnce(albums);

      const result = await controller.findAlbums(1);

      expect(result).toBe(albums);
      expect(service.findAlbums).toHaveBeenCalledWith(1);
    });
  });
});
