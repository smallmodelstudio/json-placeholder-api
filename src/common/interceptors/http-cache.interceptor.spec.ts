import { describe, it, expect, vi } from 'vitest';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Cache } from 'cache-manager';
import { of } from 'rxjs';
import { MetricsService } from '../metrics/metrics.service';
import { HttpCacheInterceptor } from './http-cache.interceptor';

type FakeCache = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

describe('HttpCacheInterceptor', () => {
  const makeInterceptor = (
    cacheManager: FakeCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn(),
    },
    metrics: MetricsService = new MetricsService(),
  ): HttpCacheInterceptor => {
    const interceptor = new HttpCacheInterceptor(
      cacheManager as unknown as Cache,
      { get: vi.fn().mockReturnValue(undefined) } as unknown as Reflector,
      metrics,
    );
    // httpAdapterHost is normally property-injected by Nest; faked here so
    // the inherited default trackBy() (exercised for non-health paths) has
    // an adapter to build its URL-based key from, and setHeader() records
    // the X-Cache header onto the same fake response `intercept()` reads
    // back from, same as the real FastifyAdapter would.
    Object.assign(interceptor, {
      httpAdapterHost: {
        httpAdapter: {
          getRequestMethod: () => 'GET',
          getRequestUrl: (req: { url: string }) => req.url,
          setHeader: (
            response: Record<string, unknown>,
            name: string,
            value: unknown,
          ) => {
            response[name] = value;
          },
        },
      },
    });
    return interceptor;
  };

  const makeContext = (
    routeUrl: string,
    url: string,
  ): { context: ExecutionContext; reply: Record<string, unknown> } => {
    const request = { routeOptions: { url: routeUrl }, url, method: 'GET' };
    const reply: Record<string, unknown> = {
      getHeader: (name: string) => reply[name],
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => reply,
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
      getArgByIndex: () => request,
    } as unknown as ExecutionContext;
    return { context, reply };
  };

  const fakeNext: CallHandler = { handle: () => of({ some: 'data' }) };

  const trackBy = (
    interceptor: HttpCacheInterceptor,
    context: ExecutionContext,
  ): unknown =>
    (
      interceptor as unknown as {
        trackBy: (context: ExecutionContext) => unknown;
      }
    ).trackBy(context);

  it('never caches the health endpoint', () => {
    const interceptor = makeInterceptor();
    const { context } = makeContext('/health', '/health');

    expect(trackBy(interceptor, context)).toBeUndefined();
  });

  it('falls back to the default URL-based cache key for other GET routes', () => {
    const interceptor = makeInterceptor();
    const { context } = makeContext('/posts', '/posts?userId=1');

    expect(trackBy(interceptor, context)).toBe('/posts?userId=1');
  });

  it('records a cache-miss metric and sets X-Cache: MISS on a lookup miss', async () => {
    const metrics = new MetricsService();
    const recordSpy = vi.spyOn(metrics, 'recordCacheLookup');
    const interceptor = makeInterceptor(undefined, metrics);
    const { context, reply } = makeContext('/posts', '/posts?userId=1');

    await interceptor.intercept(context, fakeNext);

    expect(recordSpy).toHaveBeenCalledWith('miss');
    expect(reply['X-Cache']).toBe('MISS');
  });

  it('records a cache-hit metric and sets X-Cache: HIT on a lookup hit', async () => {
    const metrics = new MetricsService();
    const recordSpy = vi.spyOn(metrics, 'recordCacheLookup');
    const interceptor = makeInterceptor(
      { get: vi.fn().mockResolvedValue({ cached: true }), set: vi.fn() },
      metrics,
    );
    const { context, reply } = makeContext('/posts', '/posts?userId=1');

    await interceptor.intercept(context, fakeNext);

    expect(recordSpy).toHaveBeenCalledWith('hit');
    expect(reply['X-Cache']).toBe('HIT');
  });

  it('records no cache metric for a request with no cache key (e.g. /health)', async () => {
    const metrics = new MetricsService();
    const recordSpy = vi.spyOn(metrics, 'recordCacheLookup');
    const interceptor = makeInterceptor(undefined, metrics);
    const { context } = makeContext('/health', '/health');

    await interceptor.intercept(context, fakeNext);

    expect(recordSpy).not.toHaveBeenCalled();
  });
});
