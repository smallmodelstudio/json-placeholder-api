import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  // A stale "ok" from the cache would defeat the point of a liveness probe,
  // so /health is excluded here rather than relying on callers to remember
  // not to cache it. Everything else falls back to the default GET-by-URL key.
  protected override trackBy(
    context: ExecutionContext,
  ): Promise<string | undefined | null> | string | undefined | null {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path.startsWith('/health')) {
      return undefined;
    }
    return super.trackBy(context);
  }
}
