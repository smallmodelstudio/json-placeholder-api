import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  // A stale "ok" from the cache would defeat the point of a liveness probe,
  // so /health is excluded here rather than relying on callers to remember
  // not to cache it. Keyed on the route pattern (not request.url, which
  // Fastify — unlike Express's request.path — bakes the query string into)
  // so the guard doesn't depend on /health never taking query params.
  // Everything else falls back to the default GET-by-URL key.
  protected override trackBy(
    context: ExecutionContext,
  ): Promise<string | undefined | null> | string | undefined | null {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.routeOptions.url?.startsWith('/health')) {
      return undefined;
    }
    return super.trackBy(context);
  }
}
