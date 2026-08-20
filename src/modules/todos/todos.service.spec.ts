import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamService } from '../../upstream/upstream.service';
import { TodosService } from './todos.service';
import { Todo } from './entities/todo.entity';

describe('TodosService', () => {
  let service: TodosService;
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
        TodosService,
        { provide: UpstreamService, useValue: upstream },
      ],
    }).compile();

    service = module.get(TodosService);
  });

  describe('findAll', () => {
    it('calls the upstream todos endpoint with no params when userId is absent', async () => {
      const todos: Todo[] = [
        { id: 1, userId: 1, title: 't', completed: false },
      ];
      upstream.get.mockResolvedValueOnce(todos);

      const result = await service.findAll({});

      expect(result).toBe(todos);
      expect(upstream.get).toHaveBeenCalledWith('/todos', {
        params: undefined,
      });
    });

    it('forwards userId as a query param when provided', async () => {
      upstream.get.mockResolvedValueOnce([]);

      await service.findAll({ userId: 7 });

      expect(upstream.get).toHaveBeenCalledWith('/todos', {
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
    it('calls the upstream endpoint for a single todo by id', async () => {
      const todo: Todo = { id: 5, userId: 1, title: 't', completed: true };
      upstream.get.mockResolvedValueOnce(todo);

      const result = await service.findOne(5);

      expect(result).toBe(todo);
      expect(upstream.get).toHaveBeenCalledWith('/todos/5');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('not found');
      upstream.get.mockRejectedValueOnce(error);

      await expect(service.findOne(999)).rejects.toThrow(error);
    });
  });

  describe('create', () => {
    it('posts the dto to the upstream todos endpoint', async () => {
      const dto = { userId: 1, title: 't', completed: false };
      const created: Todo = { id: 101, ...dto };
      upstream.post.mockResolvedValueOnce(created);

      const result = await service.create(dto);

      expect(result).toBe(created);
      expect(upstream.post).toHaveBeenCalledWith('/todos', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.post.mockRejectedValueOnce(error);

      await expect(
        service.create({ userId: 1, title: 't', completed: false }),
      ).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    it('puts the dto to the upstream endpoint for the given id', async () => {
      const dto = { userId: 1, title: 't', completed: true };
      const updated: Todo = { id: 1, ...dto };
      upstream.put.mockResolvedValueOnce(updated);

      const result = await service.update(1, dto);

      expect(result).toBe(updated);
      expect(upstream.put).toHaveBeenCalledWith('/todos/1', dto);
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.put.mockRejectedValueOnce(error);

      await expect(service.update(1, {})).rejects.toThrow(error);
    });
  });

  describe('patch', () => {
    it('patches the dto to the upstream endpoint for the given id', async () => {
      const dto = { completed: true };
      const patched: Todo = { id: 1, userId: 1, title: 't', completed: true };
      upstream.patch.mockResolvedValueOnce(patched);

      const result = await service.patch(1, dto);

      expect(result).toBe(patched);
      expect(upstream.patch).toHaveBeenCalledWith('/todos/1', dto);
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
      expect(upstream.delete).toHaveBeenCalledWith('/todos/1');
    });

    it('propagates upstream errors', async () => {
      const error = new Error('upstream failure');
      upstream.delete.mockRejectedValueOnce(error);

      await expect(service.remove(999)).rejects.toThrow(error);
    });
  });
});
