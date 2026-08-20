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
  ApiEnvelopedEmptyResponse,
  ApiEnvelopedResponse,
} from '../../common/decorators/api-envelope-response.decorator';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiEnvelopedResponse(Comment, { isArray: true })
  findAll(@Query() query: QueryCommentsDto): Promise<Comment[]> {
    return this.commentsService.findAll(query);
  }

  @Get(':id')
  @ApiEnvelopedResponse(Comment)
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Comment> {
    return this.commentsService.findOne(id);
  }

  @Post()
  @ApiEnvelopedResponse(Comment, { status: 201 })
  create(@Body() dto: CreateCommentDto): Promise<Comment> {
    return this.commentsService.create(dto);
  }

  @Put(':id')
  @ApiEnvelopedResponse(Comment)
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.update(id, dto);
  }

  @Patch(':id')
  @ApiEnvelopedResponse(Comment)
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.patch(id, dto);
  }

  @Delete(':id')
  @ApiEnvelopedEmptyResponse(
    'Comment deleted (JSONPlaceholder does not persist deletes)',
  )
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.commentsService.remove(id);
  }
}
