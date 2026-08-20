import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post as HttpPost,
  Put,
  Query,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { Comment } from '../comments/entities/comment.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './entities/post.entity';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(@Query() query: QueryPostsDto): Promise<Post[]> {
    return this.postsService.findAll(query);
  }

  @Get(':id')
  // Longer than the global cache default: a single post by id is far less
  // likely to need a fresh look than a filterable list query.
  @CacheTTL(60_000)
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Post> {
    return this.postsService.findOne(id);
  }

  @HttpPost()
  create(@Body() dto: CreatePostDto): Promise<Post> {
    return this.postsService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ): Promise<Post> {
    return this.postsService.update(id, dto);
  }

  @Patch(':id')
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ): Promise<Post> {
    return this.postsService.patch(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.postsService.remove(id);
  }

  @Get(':id/comments')
  findComments(
    @Param('id', ParsePositiveIntPipe) id: number,
  ): Promise<Comment[]> {
    return this.postsService.findComments(id);
  }
}
