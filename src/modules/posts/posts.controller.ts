import { Controller, Get, Param, Query, ValidationPipe } from '@nestjs/common';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { QueryPostsDto } from './dto/query-posts.dto';
import { Post } from './entities/post.entity';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: QueryPostsDto,
  ): Promise<Post[]> {
    return this.postsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Post> {
    return this.postsService.findOne(id);
  }
}
