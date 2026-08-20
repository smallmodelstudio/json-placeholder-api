import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { TimeoutInterceptor } from './timeout.interceptor';

describe('TimeoutInterceptor', () => {
  const makeInterceptor = (
    timeoutMs: number,
    maxRetries: number,
  ): TimeoutInterceptor => {
    const configService = {
      get: jest.fn().mockReturnValue({ timeoutMs, maxRetries }),
    } as unknown as ConfigService;
    return new TimeoutInterceptor(configService);
  };

  const context = {} as ExecutionContext;

  it('passes through a response that completes within the budget', async () => {
    // budget = 10 * (0 + 2) = 20ms
    const interceptor = makeInterceptor(10, 0);
    const handler: CallHandler = { handle: () => of('ok').pipe(delay(2)) };

    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toBe('ok');
  });

  it('maps a handler exceeding the budget to a 504', async () => {
    // budget = 5 * (0 + 2) = 10ms
    const interceptor = makeInterceptor(5, 0);
    const handler: CallHandler = { handle: () => of('slow').pipe(delay(50)) };

    await expect(
      firstValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toMatchObject({ status: 504 });
  });
});
