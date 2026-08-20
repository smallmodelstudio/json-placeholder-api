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
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findAll(@Query() query: QueryCommentsDto): Promise<Comment[]> {
    return this.commentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Comment> {
    return this.commentsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCommentDto): Promise<Comment> {
    return this.commentsService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.update(id, dto);
  }

  @Patch(':id')
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.patch(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.commentsService.remove(id);
  }
}
