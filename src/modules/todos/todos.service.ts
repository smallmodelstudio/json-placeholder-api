import { Injectable } from '@nestjs/common';
import { UpstreamService } from '../../upstream/upstream.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { QueryTodosDto } from './dto/query-todos.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './entities/todo.entity';

@Injectable()
export class TodosService {
  constructor(private readonly upstream: UpstreamService) {}

  findAll(query: QueryTodosDto): Promise<Todo[]> {
    return this.upstream.get<Todo[]>('/todos', {
      ...(query.userId !== undefined && { params: { userId: query.userId } }),
    });
  }

  findOne(id: number): Promise<Todo> {
    return this.upstream.get<Todo>(`/todos/${id}`);
  }

  create(dto: CreateTodoDto): Promise<Todo> {
    return this.upstream.post<Todo>('/todos', dto);
  }

  update(id: number, dto: UpdateTodoDto): Promise<Todo> {
    return this.upstream.put<Todo>(`/todos/${id}`, dto);
  }

  patch(id: number, dto: UpdateTodoDto): Promise<Todo> {
    return this.upstream.patch<Todo>(`/todos/${id}`, dto);
  }

  remove(id: number): Promise<object> {
    return this.upstream.delete<object>(`/todos/${id}`);
  }
}
