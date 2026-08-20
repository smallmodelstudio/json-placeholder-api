import { Module } from '@nestjs/common';
import { UpstreamModule } from '../../upstream/upstream.module';
import { AlbumsModule } from '../albums/albums.module';
import { PostsModule } from '../posts/posts.module';
import { TodosModule } from '../todos/todos.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [UpstreamModule, PostsModule, TodosModule, AlbumsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
