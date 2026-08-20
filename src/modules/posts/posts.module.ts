import { Module } from '@nestjs/common';
import { UpstreamModule } from '../../upstream/upstream.module';
import { CommentsModule } from '../comments/comments.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [UpstreamModule, CommentsModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
