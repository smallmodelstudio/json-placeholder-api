import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post as HttpPost,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopedEmptyResponse,
  ApiEnvelopedResponse,
} from '../../common/decorators/api-envelope-response.decorator';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { Album } from '../albums/entities/album.entity';
import { Post } from '../posts/entities/post.entity';
import { Todo } from '../todos/entities/todo.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiEnvelopedResponse(User, { isArray: true })
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiEnvelopedResponse(User)
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<User> {
    return this.usersService.findOne(id);
  }

  @HttpPost()
  @ApiEnvelopedResponse(User, { status: 201 })
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @ApiEnvelopedResponse(User)
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, dto);
  }

  @Patch(':id')
  @ApiEnvelopedResponse(User)
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.patch(id, dto);
  }

  @Delete(':id')
  @ApiEnvelopedEmptyResponse(
    'User deleted (JSONPlaceholder does not persist deletes)',
  )
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.usersService.remove(id);
  }

  @Get(':id/posts')
  @ApiEnvelopedResponse(Post, { isArray: true })
  findPosts(@Param('id', ParsePositiveIntPipe) id: number): Promise<Post[]> {
    return this.usersService.findPosts(id);
  }

  @Get(':id/todos')
  @ApiEnvelopedResponse(Todo, { isArray: true })
  findTodos(@Param('id', ParsePositiveIntPipe) id: number): Promise<Todo[]> {
    return this.usersService.findTodos(id);
  }

  @Get(':id/albums')
  @ApiEnvelopedResponse(Album, { isArray: true })
  findAlbums(@Param('id', ParsePositiveIntPipe) id: number): Promise<Album[]> {
    return this.usersService.findAlbums(id);
  }
}
