import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { UpstreamService } from './upstream.service';
import {
  UpstreamErrorType,
  UpstreamException,
} from '../common/exceptions/upstream.exception';
import { MetricsService } from '../common/metrics/metrics.service';

/**
 * @nestjs/axios's HttpService.request() wraps each call in `new Observable(...)`,
 * so a fresh "attempt" happens on every *subscription*, not on every call to the
 * mocked function (which the SUT invokes exactly once and pipes `retry()` onto).
 * This helper reproduces that per-subscription semantics so retry behaviour can
 * be exercised: each subscribe pulls the next observable in the sequence,
 * clamping to the last one once exhausted.
 */
function respondWith<T>(...emissions: Observable<T>[]) {
  let attempt = 0;
  const attempts = vi.fn();
  const source = new Observable<T>((subscriber) => {
    attempts();
    const emission = emissions[Math.min(attempt, emissions.length - 1)];
    attempt += 1;
    if (!emission) {
      throw new Error('respondWith requires at least one emission');
    }
    return emission.subscribe(subscriber);
  });
  return { source, attempts };
}

describe('UpstreamService', () => {
  let service: UpstreamService;
  let metrics: MetricsService;
  let httpService: { request: Mock };

  const makeAxiosResponse = <T>(data: T): AxiosResponse<T> =>
    ({
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    }) as AxiosResponse<T>;

  const makeAxiosError = (overrides: Partial<AxiosError> = {}): AxiosError => {
    const error = new Error('axios error') as AxiosError;
    error.isAxiosError = true;
    error.toJSON = () => ({});
    return Object.assign(error, overrides);
  };

  beforeEach(async () => {
    httpService = { request: vi.fn() };

    const configValues: Record<string, unknown> = {
      'http.baseUrl': 'https://jsonplaceholder.typicode.com',
      'http.timeoutMs': 5000,
      'http.maxRetries': 2,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpstreamService,
        MetricsService,
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: { get: vi.fn((key: string) => configValues[key]) },
        },
      ],
    }).compile();

    service = module.get(UpstreamService);
    metrics = module.get(MetricsService);
  });

  it('returns response data on success', async () => {
    httpService.request.mockReturnValueOnce(of(makeAxiosResponse({ id: 1 })));

    const result = await service.get<{ id: number }>('/posts/1');

    expect(result).toEqual({ id: 1 });
    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: '/posts/1' }),
    );
  });

  it('passes query params and a request body through to the client', async () => {
    httpService.request.mockReturnValueOnce(of(makeAxiosResponse({ id: 1 })));

    await service.post('/posts', { title: 'hi' }, { params: { userId: 1 } });

    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/posts',
        data: { title: 'hi' },
        params: { userId: 1 },
      }),
    );
  });

  it('sends a PUT with the request body', async () => {
    httpService.request.mockReturnValueOnce(of(makeAxiosResponse({ id: 1 })));

    await service.put('/posts/1', { title: 'replaced' });

    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: '/posts/1',
        data: { title: 'replaced' },
      }),
    );
  });

  it('sends a PATCH with the request body', async () => {
    httpService.request.mockReturnValueOnce(of(makeAxiosResponse({ id: 1 })));

    await service.patch('/posts/1', { title: 'patched' });

    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PATCH',
        url: '/posts/1',
        data: { title: 'patched' },
      }),
    );
  });

  it('sends a DELETE with no body', async () => {
    httpService.request.mockReturnValueOnce(of(makeAxiosResponse({})));

    await service.delete('/posts/1');

    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE', url: '/posts/1' }),
    );
  });

  it('retries a 5xx response and returns the eventual success', async () => {
    const serverError = makeAxiosError({
      response: { status: 503 } as AxiosResponse,
    });
    const { source, attempts } = respondWith(
      throwError(() => serverError),
      of(makeAxiosResponse({ id: 1 })),
    );
    httpService.request.mockReturnValueOnce(source);

    const recordRetrySpy = vi.spyOn(metrics, 'recordUpstreamRetry');

    const result = await service.get<{ id: number }>('/posts/1');

    expect(result).toEqual({ id: 1 });
    expect(attempts).toHaveBeenCalledTimes(2);
    expect(recordRetrySpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 4xx response', async () => {
    const notFound = makeAxiosError({
      response: { status: 404 } as AxiosResponse,
    });
    const { source, attempts } = respondWith(throwError(() => notFound));
    httpService.request.mockReturnValueOnce(source);

    await expect(service.get('/posts/999')).rejects.toMatchObject({
      type: UpstreamErrorType.BAD_RESPONSE,
      upstreamStatus: 404,
    });
    expect(attempts).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries and maps a persistent 5xx to UpstreamException', async () => {
    const serverError = makeAxiosError({
      response: { status: 500 } as AxiosResponse,
    });
    const { source, attempts } = respondWith(throwError(() => serverError));
    httpService.request.mockReturnValueOnce(source);

    await expect(service.get('/posts/1')).rejects.toBeInstanceOf(
      UpstreamException,
    );
    // initial attempt + 2 retries (maxRetries = 2) = 3 attempts total
    expect(attempts).toHaveBeenCalledTimes(3);
  });

  it('retries a connection-level network error and maps it if exhausted', async () => {
    const networkError = makeAxiosError({ code: 'ECONNREFUSED' });
    const { source, attempts } = respondWith(throwError(() => networkError));
    httpService.request.mockReturnValueOnce(source);

    await expect(service.get('/posts/1')).rejects.toMatchObject({
      type: UpstreamErrorType.NETWORK_ERROR,
    });
    expect(attempts).toHaveBeenCalledTimes(3);
  });

  it('maps an axios timeout to an UpstreamException with TIMEOUT type', async () => {
    const timeoutError = makeAxiosError({ code: 'ECONNABORTED' });
    const { source } = respondWith(throwError(() => timeoutError));
    httpService.request.mockReturnValueOnce(source);

    await expect(service.get('/posts/1')).rejects.toMatchObject({
      type: UpstreamErrorType.TIMEOUT,
    });
  });

  it('preserves the upstream status code on the mapped exception', async () => {
    const badRequest = makeAxiosError({
      response: { status: 400 } as AxiosResponse,
    });
    httpService.request.mockReturnValueOnce(throwError(() => badRequest));

    await expect(service.get('/posts/1')).rejects.toMatchObject({
      upstreamStatus: 400,
    });
  });

  it('does not retry a POST on a 5xx response (retrying risks a duplicate write)', async () => {
    const serverError = makeAxiosError({
      response: { status: 500 } as AxiosResponse,
    });
    const { source, attempts } = respondWith(throwError(() => serverError));
    httpService.request.mockReturnValueOnce(source);

    await expect(
      service.post('/posts', { title: 'hi' }),
    ).rejects.toBeInstanceOf(UpstreamException);
    expect(attempts).toHaveBeenCalledTimes(1);
  });

  it('does not retry a PATCH on a network error', async () => {
    const networkError = makeAxiosError({ code: 'ECONNREFUSED' });
    const { source, attempts } = respondWith(throwError(() => networkError));
    httpService.request.mockReturnValueOnce(source);

    await expect(
      service.patch('/posts/1', { title: 'hi' }),
    ).rejects.toBeInstanceOf(UpstreamException);
    expect(attempts).toHaveBeenCalledTimes(1);
  });

  it('still retries a DELETE on a 5xx response', async () => {
    const serverError = makeAxiosError({
      response: { status: 503 } as AxiosResponse,
    });
    const { source, attempts } = respondWith(
      throwError(() => serverError),
      of(makeAxiosResponse({})),
    );
    httpService.request.mockReturnValueOnce(source);

    await service.delete('/posts/1');

    expect(attempts).toHaveBeenCalledTimes(2);
  });

  it('maps a non-axios error to NETWORK_ERROR', async () => {
    httpService.request.mockReturnValueOnce(
      throwError(() => new Error('boom')),
    );

    await expect(service.get('/posts/1')).rejects.toMatchObject({
      type: UpstreamErrorType.NETWORK_ERROR,
    });
  });
});
