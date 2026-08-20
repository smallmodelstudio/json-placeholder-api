import { Injectable } from '@nestjs/common';
import { UpstreamService } from '../../upstream/upstream.service';
import { Album } from '../albums/entities/album.entity';
import { AlbumsService } from '../albums/albums.service';
import { Post } from '../posts/entities/post.entity';
import { PostsService } from '../posts/posts.service';
import { Todo } from '../todos/entities/todo.entity';
import { TodosService } from '../todos/todos.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly upstream: UpstreamService,
    private readonly postsService: PostsService,
    private readonly todosService: TodosService,
    private readonly albumsService: AlbumsService,
  ) {}

  findAll(): Promise<User[]> {
    return this.upstream.get<User[]>('/users');
  }

  findOne(id: number): Promise<User> {
    return this.upstream.get<User>(`/users/${id}`);
  }

  create(dto: CreateUserDto): Promise<User> {
    return this.upstream.post<User>('/users', dto);
  }

  update(id: number, dto: UpdateUserDto): Promise<User> {
    return this.upstream.put<User>(`/users/${id}`, dto);
  }

  patch(id: number, dto: UpdateUserDto): Promise<User> {
    return this.upstream.patch<User>(`/users/${id}`, dto);
  }

  remove(id: number): Promise<object> {
    return this.upstream.delete<object>(`/users/${id}`);
  }

  findPosts(userId: number): Promise<Post[]> {
    return this.postsService.findAll({ userId });
  }

  findTodos(userId: number): Promise<Todo[]> {
    return this.todosService.findAll({ userId });
  }

  findAlbums(userId: number): Promise<Album[]> {
    return this.albumsService.findAll({ userId });
  }
}
