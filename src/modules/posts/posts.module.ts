import { Module } from '@nestjs/common';
import { UpstreamModule } from '../../upstream/upstream.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [UpstreamModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
