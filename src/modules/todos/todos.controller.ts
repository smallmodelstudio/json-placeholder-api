import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { CreateTodoDto } from './dto/create-todo.dto';
import { QueryTodosDto } from './dto/query-todos.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './entities/todo.entity';
import { TodosService } from './todos.service';

@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  findAll(@Query() query: QueryTodosDto): Promise<Todo[]> {
    return this.todosService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Todo> {
    return this.todosService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTodoDto): Promise<Todo> {
    return this.todosService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateTodoDto,
  ): Promise<Todo> {
    return this.todosService.update(id, dto);
  }

  @Patch(':id')
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateTodoDto,
  ): Promise<Todo> {
    return this.todosService.patch(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.todosService.remove(id);
  }
}
