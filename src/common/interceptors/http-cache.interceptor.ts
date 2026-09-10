import { CACHE_MANAGER, CacheInterceptor } from '@nestjs/cache-manager';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Cache } from 'cache-manager';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    reflector: Reflector,
    private readonly metrics: MetricsService,
  ) {
    super(cacheManager, reflector);
  }

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

  // The base CacheInterceptor already sets an X-Cache: HIT/MISS response
  // header (setHeadersWhenHttp) as a side effect of its own lookup, before
  // returning — reading it back here is cheaper and more honest than a
  // second, separate cacheManager.get() just to observe hit/miss.
  override async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const observable = await super.intercept(context, next);
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const cacheHeader = reply.getHeader('X-Cache');
    if (cacheHeader !== undefined) {
      this.metrics.recordCacheLookup(cacheHeader === 'HIT' ? 'hit' : 'miss');
    }
    return observable;
  }
}
