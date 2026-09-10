import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpCacheInterceptor } from './http-cache.interceptor';

describe('HttpCacheInterceptor', () => {
  const makeInterceptor = (): HttpCacheInterceptor => {
    const interceptor = new HttpCacheInterceptor(
      { get: vi.fn(), set: vi.fn() },
      { get: vi.fn().mockReturnValue(undefined) } as unknown as Reflector,
    );
    // httpAdapterHost is normally property-injected by Nest; faked here so
    // the inherited default trackBy() (exercised for non-health paths) has
    // an adapter to build its URL-based key from.
    Object.assign(interceptor, {
      httpAdapterHost: {
        httpAdapter: {
          getRequestMethod: () => 'GET',
          getRequestUrl: (req: { url: string }) => req.url,
        },
      },
    });
    return interceptor;
  };

  const makeContext = (path: string, url: string): ExecutionContext => {
    const request = { path, url, method: 'GET' };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
      getArgByIndex: () => request,
    } as unknown as ExecutionContext;
  };

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

    expect(
      trackBy(interceptor, makeContext('/health', '/health')),
    ).toBeUndefined();
  });

  it('falls back to the default URL-based cache key for other GET routes', () => {
    const interceptor = makeInterceptor();

    expect(trackBy(interceptor, makeContext('/posts', '/posts?userId=1'))).toBe(
      '/posts?userId=1',
    );
  });
});
