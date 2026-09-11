import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiResponse, ApiTags, SchemaObject } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { AppConfig } from '../config/config.types';
import {
  envelopeSchema,
  errorEnvelopeSchema,
} from '../common/decorators/api-envelope-response.decorator';

const healthResultSchema: SchemaObject = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'ok' },
    info: { type: 'object', additionalProperties: true, nullable: true },
    error: { type: 'object', additionalProperties: true, nullable: true },
    details: { type: 'object', additionalProperties: true },
  },
};

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  // Terminus's own @HealthCheck() would otherwise auto-document a bare
  // HealthCheckResult, but these routes flow through the same global
  // TransformInterceptor as everything else — its swagger docs are
  // disabled here in favor of explicit, envelope-aware responses.

  @Get('live')
  @HealthCheck({ swaggerDocumentation: false })
  @ApiResponse({
    status: 200,
    description: 'The process is up.',
    schema: envelopeSchema(healthResultSchema),
  })
  // No indicators: liveness must never fail because of upstream trouble, or
  // Kubernetes would restart every pod in a loop for a fault none of them
  // can fix.
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck({ swaggerDocumentation: false })
  @ApiResponse({
    status: 200,
    description: 'The upstream is reachable.',
    schema: envelopeSchema(healthResultSchema),
  })
  // Not a { data, meta } envelope like every other response, success or
  // failure: HealthCheckService.check() *throws* a ServiceUnavailableException
  // (with the HealthCheckResult as its body) rather than resolving one, so
  // this goes through AllExceptionsFilter and out as the same error envelope
  // every other failure uses.
  @ApiResponse({
    status: 503,
    description: 'The upstream is unreachable.',
    schema: errorEnvelopeSchema,
  })
  async ready(): Promise<HealthCheckResult> {
    const baseUrl = this.configService.get('http.baseUrl', { infer: true });
    try {
      // /posts/1 is a small, always-present resource — a reasonable
      // stand-in for a dedicated health/ping endpoint, which
      // JSONPlaceholder lacks.
      return await this.health.check([
        () => this.http.pingCheck('upstream', `${baseUrl}/posts/1`),
      ]);
    } catch (error) {
      // HealthCheckService's own exception carries the whole
      // HealthCheckResult as its body, not a string message — left as-is,
      // it would reach AllExceptionsFilter's generic fallback and produce
      // a vague "Service Unavailable Exception". Naming the failed check
      // here instead makes the error envelope's `message` actually say
      // what's wrong.
      if (error instanceof ServiceUnavailableException) {
        const result = error.getResponse() as HealthCheckResult;
        const failedChecks = Object.keys(result.error ?? {});
        throw new ServiceUnavailableException(
          failedChecks.length > 0
            ? `Health check failed: ${failedChecks.join(', ')}`
            : 'Health check failed',
        );
      }
      throw error;
    }
  }
}
