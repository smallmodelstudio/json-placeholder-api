import { Injectable } from '@nestjs/common';
import { UpstreamService } from '../../upstream/upstream.service';
import { CommentsService } from '../comments/comments.service';
import { Comment } from '../comments/entities/comment.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    private readonly upstream: UpstreamService,
    private readonly commentsService: CommentsService,
  ) {}

  findAll(query: QueryPostsDto): Promise<Post[]> {
    return this.upstream.get<Post[]>('/posts', {
      params: query.userId !== undefined ? { userId: query.userId } : undefined,
    });
  }

  findOne(id: number): Promise<Post> {
    return this.upstream.get<Post>(`/posts/${id}`);
  }

  create(dto: CreatePostDto): Promise<Post> {
    return this.upstream.post<Post>('/posts', dto);
  }

  update(id: number, dto: UpdatePostDto): Promise<Post> {
    return this.upstream.put<Post>(`/posts/${id}`, dto);
  }

  patch(id: number, dto: UpdatePostDto): Promise<Post> {
    return this.upstream.patch<Post>(`/posts/${id}`, dto);
  }

  remove(id: number): Promise<object> {
    return this.upstream.delete<object>(`/posts/${id}`);
  }

  findComments(postId: number): Promise<Comment[]> {
    return this.commentsService.findAll({ postId });
  }
}
