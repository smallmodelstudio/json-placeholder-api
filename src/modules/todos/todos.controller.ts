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
import { ApiTags } from '@nestjs/swagger';
import {
  ApiCommonErrorResponses,
  ApiEnvelopedEmptyResponse,
  ApiEnvelopedResponse,
} from '../../common/decorators/api-envelope-response.decorator';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { CreateTodoDto } from './dto/create-todo.dto';
import { QueryTodosDto } from './dto/query-todos.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './entities/todo.entity';
import { TodosService } from './todos.service';

@ApiTags('todos')
@ApiCommonErrorResponses()
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  @ApiEnvelopedResponse(Todo, { isArray: true })
  findAll(@Query() query: QueryTodosDto): Promise<Todo[]> {
    return this.todosService.findAll(query);
  }

  @Get(':id')
  @ApiEnvelopedResponse(Todo)
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Todo> {
    return this.todosService.findOne(id);
  }

  @Post()
  @ApiEnvelopedResponse(Todo, { status: 201 })
  create(@Body() dto: CreateTodoDto): Promise<Todo> {
    return this.todosService.create(dto);
  }

  // PUT is a full replace — see PostsController.update()'s comment for why
  // PATCH below uses a different (partial) DTO.
  @Put(':id')
  @ApiEnvelopedResponse(Todo)
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: CreateTodoDto,
  ): Promise<Todo> {
    return this.todosService.update(id, dto);
  }

  @Patch(':id')
  @ApiEnvelopedResponse(Todo)
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateTodoDto,
  ): Promise<Todo> {
    return this.todosService.patch(id, dto);
  }

  @Delete(':id')
  @ApiEnvelopedEmptyResponse(
    'Todo deleted (JSONPlaceholder does not persist deletes)',
  )
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.todosService.remove(id);
  }
}
