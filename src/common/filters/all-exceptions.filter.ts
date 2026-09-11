import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { STATUS_CODES } from 'node:http';
import { ThrottlerException } from '@nestjs/throttler';
import {
  UpstreamErrorType,
  UpstreamException,
} from '../exceptions/upstream.exception';
import { MetricsService } from '../metrics/metrics.service';

interface ResolvedError {
  statusCode: number;
  message: string | string[];
  error: string;
}

interface ErrorEnvelope extends ResolvedError {
  path: string;
  timestamp: string;
  correlationId: string;
}

// Typed as `number` (not `HttpStatus`) so it can be compared against
// `resolved.statusCode`, which is a plain number that isn't necessarily one
// of the named HttpStatus members (e.g. a passed-through upstream 4xx).
const SERVER_ERROR_THRESHOLD: number = HttpStatus.INTERNAL_SERVER_ERROR;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly metrics: MetricsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const resolved = this.resolve(exception);

    if (resolved.statusCode >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(
        `${request.method} ${request.url} -> ${resolved.statusCode} [${request.correlationId}]`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const envelope: ErrorEnvelope = {
      ...resolved,
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId: request.correlationId,
    };

    response.status(resolved.statusCode).send(envelope);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof ThrottlerException) {
      this.metrics.recordThrottleRejection();
    }

    if (exception instanceof UpstreamException) {
      return this.resolveUpstreamException(exception);
    }

    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private resolveUpstreamException(
    exception: UpstreamException,
  ): ResolvedError {
    if (exception.type === UpstreamErrorType.TIMEOUT) {
      return {
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        message: 'Upstream request timed out',
        error: 'Gateway Timeout',
      };
    }

    // A 4xx from upstream reflects something meaningful about the request
    // itself (e.g. a post that doesn't exist), so it's passed through as-is.
    // Anything else — a 5xx response, or no response at all — means the
    // upstream failed us, which is a 502 regardless of the underlying cause.
    if (
      exception.upstreamStatus !== undefined &&
      exception.upstreamStatus < 500
    ) {
      return {
        statusCode: exception.upstreamStatus,
        message: exception.message,
        error: STATUS_CODES[exception.upstreamStatus] ?? 'Error',
      };
    }

    return {
      statusCode: HttpStatus.BAD_GATEWAY,
      message: 'Upstream service returned an invalid response',
      error: 'Bad Gateway',
    };
  }

  private resolveHttpException(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'string') {
      return { statusCode, message: body, error: exception.name };
    }

    // Most HttpExceptions carry a `{ message, error }` body (Nest's own
    // built-in exceptions, and everything this app throws directly). But
    // that's a convention, not something `HttpException` enforces — e.g.
    // Terminus's HealthCheckService throws a ServiceUnavailableException
    // whose body is the whole HealthCheckResult object, with its own
    // unrelated `error` key (failed checks, not an HTTP error name).
    // Passing that straight through would put a HealthCheckResult where
    // clients expect a string, breaking the one envelope shape this API
    // promises for every error. Falling back to the exception's own
    // message/name below keeps the envelope honest for any exception body
    // shape, not just the ones this codebase happens to throw today.
    const { message, error } = body as { message?: unknown; error?: unknown };
    return {
      statusCode,
      message: this.isMessage(message) ? message : exception.message,
      error:
        typeof error === 'string'
          ? error
          : (STATUS_CODES[statusCode] ?? exception.name),
    };
  }

  private isMessage(value: unknown): value is string | string[] {
    return (
      typeof value === 'string' ||
      (Array.isArray(value) && value.every((item) => typeof item === 'string'))
    );
  }
}
