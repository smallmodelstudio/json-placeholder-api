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
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { Album } from '../albums/entities/album.entity';
import { Post } from '../posts/entities/post.entity';
import { Todo } from '../todos/entities/todo.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<User> {
    return this.usersService.findOne(id);
  }

  @HttpPost()
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, dto);
  }

  @Patch(':id')
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.patch(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.usersService.remove(id);
  }

  @Get(':id/posts')
  findPosts(@Param('id', ParsePositiveIntPipe) id: number): Promise<Post[]> {
    return this.usersService.findPosts(id);
  }

  @Get(':id/todos')
  findTodos(@Param('id', ParsePositiveIntPipe) id: number): Promise<Todo[]> {
    return this.usersService.findTodos(id);
  }

  @Get(':id/albums')
  findAlbums(@Param('id', ParsePositiveIntPipe) id: number): Promise<Album[]> {
    return this.usersService.findAlbums(id);
  }
}
