import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  vi,
  MockInstance,
} from 'vitest';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: MockInstance;
  let warnSpy: MockInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  const makeContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/posts',
          correlationId: 'corr-1',
        }),
      }),
    }) as unknown as ExecutionContext;

  it('logs method, path, duration, and correlation id on success', async () => {
    const handler: CallHandler = { handle: () => of({ id: 1 }) };

    await firstValueFrom(interceptor.intercept(makeContext(), handler));

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('GET /posts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('corr-1'));
  });

  it('logs a warning with the error message on failure', async () => {
    const handler: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      firstValueFrom(interceptor.intercept(makeContext(), handler)),
    ).rejects.toThrow('boom');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });
});
