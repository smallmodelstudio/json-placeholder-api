import { Injectable } from '@nestjs/common';
import { UpstreamService } from '../../upstream/upstream.service';
import { QueryPostsDto } from './dto/query-posts.dto';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  constructor(private readonly upstream: UpstreamService) {}

  findAll(query: QueryPostsDto): Promise<Post[]> {
    return this.upstream.get<Post[]>('/posts', {
      params: query.userId !== undefined ? { userId: query.userId } : undefined,
    });
  }

  findOne(id: number): Promise<Post> {
    return this.upstream.get<Post>(`/posts/${id}`);
  }
}
