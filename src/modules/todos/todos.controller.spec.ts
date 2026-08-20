import { Test, TestingModule } from '@nestjs/testing';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { Todo } from './entities/todo.entity';

describe('TodosController', () => {
  let controller: TodosController;
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
      controllers: [TodosController],
      providers: [{ provide: TodosService, useValue: service }],
    }).compile();

    controller = module.get(TodosController);
  });

  describe('findAll', () => {
    it('delegates to TodosService.findAll with the query dto', async () => {
      const todos: Todo[] = [
        { id: 1, userId: 1, title: 't', completed: false },
      ];
      service.findAll.mockResolvedValueOnce(todos);

      const result = await controller.findAll({ userId: 1 });

      expect(result).toBe(todos);
      expect(service.findAll).toHaveBeenCalledWith({ userId: 1 });
    });
  });

  describe('findOne', () => {
    it('delegates to TodosService.findOne with the parsed id', async () => {
      const todo: Todo = { id: 5, userId: 1, title: 't', completed: true };
      service.findOne.mockResolvedValueOnce(todo);

      const result = await controller.findOne(5);

      expect(result).toBe(todo);
      expect(service.findOne).toHaveBeenCalledWith(5);
    });
  });

  describe('create', () => {
    it('delegates to TodosService.create with the body dto', async () => {
      const dto = { userId: 1, title: 't', completed: false };
      const created: Todo = { id: 101, ...dto };
      service.create.mockResolvedValueOnce(created);

      const result = await controller.create(dto);

      expect(result).toBe(created);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('delegates to TodosService.update with the parsed id and body dto', async () => {
      const dto = { userId: 1, title: 't', completed: true };
      const updated: Todo = { id: 5, ...dto };
      service.update.mockResolvedValueOnce(updated);

      const result = await controller.update(5, dto);

      expect(result).toBe(updated);
      expect(service.update).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('patch', () => {
    it('delegates to TodosService.patch with the parsed id and body dto', async () => {
      const dto = { completed: true };
      const patched: Todo = { id: 5, userId: 1, title: 't', completed: true };
      service.patch.mockResolvedValueOnce(patched);

      const result = await controller.patch(5, dto);

      expect(result).toBe(patched);
      expect(service.patch).toHaveBeenCalledWith(5, dto);
    });
  });

  describe('remove', () => {
    it('delegates to TodosService.remove with the parsed id', async () => {
      service.remove.mockResolvedValueOnce({});

      const result = await controller.remove(5);

      expect(result).toEqual({});
      expect(service.remove).toHaveBeenCalledWith(5);
    });
  });
});
