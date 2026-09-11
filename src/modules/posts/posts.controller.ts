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
import { ApiTags } from '@nestjs/swagger';
import {
  ApiCommonErrorResponses,
  ApiEnvelopedEmptyResponse,
  ApiEnvelopedResponse,
} from '../../common/decorators/api-envelope-response.decorator';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { Comment } from '../comments/entities/comment.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './entities/post.entity';
import { PostsService } from './posts.service';

@ApiTags('posts')
@ApiCommonErrorResponses()
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ApiEnvelopedResponse(Post, { isArray: true })
  findAll(@Query() query: QueryPostsDto): Promise<Post[]> {
    return this.postsService.findAll(query);
  }

  @Get(':id')
  // Longer than the global cache default: a single post by id is far less
  // likely to need a fresh look than a filterable list query.
  @CacheTTL(60_000)
  @ApiEnvelopedResponse(Post)
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Post> {
    return this.postsService.findOne(id);
  }

  @HttpPost()
  @ApiEnvelopedResponse(Post, { status: 201 })
  create(@Body() dto: CreatePostDto): Promise<Post> {
    return this.postsService.create(dto);
  }

  // PUT is a full replace, so — unlike PATCH below — it requires every
  // field CreatePostDto requires, not just the ones being changed.
  // Accepting UpdatePostDto's PartialType here would let a partial body
  // through PUT, silently leaving the upstream's other fields untouched
  // instead of replacing the resource as PUT's semantics promise.
  @Put(':id')
  @ApiEnvelopedResponse(Post)
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: CreatePostDto,
  ): Promise<Post> {
    return this.postsService.update(id, dto);
  }

  @Patch(':id')
  @ApiEnvelopedResponse(Post)
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ): Promise<Post> {
    return this.postsService.patch(id, dto);
  }

  @Delete(':id')
  @ApiEnvelopedEmptyResponse(
    'Post deleted (JSONPlaceholder does not persist deletes)',
  )
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.postsService.remove(id);
  }

  @Get(':id/comments')
  @ApiEnvelopedResponse(Comment, { isArray: true })
  findComments(
    @Param('id', ParsePositiveIntPipe) id: number,
  ): Promise<Comment[]> {
    return this.postsService.findComments(id);
  }
}
