import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  vi,
  Mock,
  MockInstance,
} from 'vitest';
import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import {
  UpstreamErrorType,
  UpstreamException,
} from '../exceptions/upstream.exception';
import { MetricsService } from '../metrics/metrics.service';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let metrics: MetricsService;
  let sendMock: Mock<(response: Record<string, unknown>) => void>;
  let statusMock: Mock;
  let host: ArgumentsHost;
  let errorSpy: MockInstance;

  beforeEach(() => {
    metrics = new MetricsService();
    filter = new AllExceptionsFilter(metrics);
    sendMock = vi.fn<(response: Record<string, unknown>) => void>();
    statusMock = vi.fn().mockReturnValue({ send: sendMock });
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/posts/1',
          correlationId: 'corr-1',
        }),
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('passes through a 4xx UpstreamException status unchanged', () => {
    const exception = new UpstreamException(
      UpstreamErrorType.BAD_RESPONSE,
      'Upstream responded with 404: GET /posts/999',
      404,
    );

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Not Found',
        error: 'Not Found',
        correlationId: 'corr-1',
        path: '/posts/1',
      }),
    );
  });

  it("doesn't leak the internal exception message (method/path) into a 4xx UpstreamException's client-facing message", () => {
    const exception = new UpstreamException(
      UpstreamErrorType.BAD_RESPONSE,
      'Upstream responded with 404: GET /posts/999',
      404,
    );

    filter.catch(exception, host);

    const call = sendMock.mock.calls[0];
    if (!call) {
      throw new Error('expected sendMock to have been called');
    }
    expect(call[0]['message']).not.toContain('GET');
    expect(call[0]['message']).not.toContain('/posts/999');
  });

  it('maps a 5xx UpstreamException to 502 Bad Gateway', () => {
    const exception = new UpstreamException(
      UpstreamErrorType.BAD_RESPONSE,
      'server error',
      500,
    );

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(502);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 502, error: 'Bad Gateway' }),
    );
  });

  it('maps a NETWORK_ERROR UpstreamException to 502', () => {
    const exception = new UpstreamException(
      UpstreamErrorType.NETWORK_ERROR,
      'econnrefused',
    );

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(502);
  });

  it('maps a TIMEOUT UpstreamException to 504', () => {
    const exception = new UpstreamException(
      UpstreamErrorType.TIMEOUT,
      'timed out',
    );

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(504);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Gateway Timeout' }),
    );
  });

  it('formats a standard HttpException using its own status and response', () => {
    const exception = new BadRequestException([
      'userId must be a positive number',
    ]);

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['userId must be a positive number'],
        error: 'Bad Request',
      }),
    );
  });

  it('falls back to the exception message/status text when the body has no string message/error (e.g. Terminus)', () => {
    // Terminus's HealthCheckService throws exactly this shape: the whole
    // HealthCheckResult as the exception body, with its own unrelated
    // `error` object (failed checks) rather than an HTTP error name string.
    const exception = new ServiceUnavailableException({
      status: 'error',
      info: {},
      error: { upstream: { status: 'down' } },
      details: {},
    });

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        message: 'Service Unavailable Exception',
        error: 'Service Unavailable',
      }),
    );
  });

  it('formats an unexpected error as a generic 500', () => {
    filter.catch(new Error('boom'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      }),
    );
  });

  it('includes path, timestamp, and correlationId on every envelope', () => {
    filter.catch(new NotFoundException(), host);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/posts/1',
        correlationId: 'corr-1',
      }),
    );
    const call = sendMock.mock.calls[0];
    if (!call) {
      throw new Error('expected sendMock to have been called');
    }
    expect(call[0]['timestamp']).toEqual(expect.any(String));
  });

  it('logs server errors (5xx) but the log call does not affect the response', () => {
    filter.catch(new Error('boom'), host);

    expect(errorSpy).toHaveBeenCalled();
  });

  it('records a throttle-rejection metric for a ThrottlerException', () => {
    const recordSpy = vi.spyOn(metrics, 'recordThrottleRejection');

    filter.catch(new ThrottlerException(), host);

    expect(recordSpy).toHaveBeenCalledOnce();
  });

  it('does not record a throttle-rejection metric for other exceptions', () => {
    const recordSpy = vi.spyOn(metrics, 'recordThrottleRejection');

    filter.catch(new NotFoundException(), host);

    expect(recordSpy).not.toHaveBeenCalled();
  });
});
