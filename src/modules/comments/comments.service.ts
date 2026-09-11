import { Injectable } from '@nestjs/common';
import { UpstreamService } from '../../upstream/upstream.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(private readonly upstream: UpstreamService) {}

  findAll(query: QueryCommentsDto): Promise<Comment[]> {
    return this.upstream.get<Comment[]>('/comments', {
      ...(query.postId !== undefined && { params: { postId: query.postId } }),
    });
  }

  findOne(id: number): Promise<Comment> {
    return this.upstream.get<Comment>(`/comments/${id}`);
  }

  create(dto: CreateCommentDto): Promise<Comment> {
    return this.upstream.post<Comment>('/comments', dto);
  }

  // PUT is a full replace — see PostsController.update()'s comment.
  update(id: number, dto: CreateCommentDto): Promise<Comment> {
    return this.upstream.put<Comment>(`/comments/${id}`, dto);
  }

  patch(id: number, dto: UpdateCommentDto): Promise<Comment> {
    return this.upstream.patch<Comment>(`/comments/${id}`, dto);
  }

  remove(id: number): Promise<object> {
    return this.upstream.delete<object>(`/comments/${id}`);
  }
}
