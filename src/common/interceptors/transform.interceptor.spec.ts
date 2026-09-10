import { describe, it, beforeEach, expect } from 'vitest';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const makeContext = (correlationId: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ correlationId }),
      }),
    }) as unknown as ExecutionContext;

  it('wraps the handler result in a data/meta envelope', async () => {
    const context = makeContext('corr-1');
    const handler: CallHandler = { handle: () => of({ id: 1 }) };

    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result.data).toEqual({ id: 1 });
    expect(result.meta.correlationId).toBe('corr-1');
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });
});
