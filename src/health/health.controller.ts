import { Controller, Get } from '@nestjs/common';
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
import { envelopeSchema } from '../common/decorators/api-envelope-response.decorator';

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
  // can fix (see PLAN.md Phase 5).
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
  @ApiResponse({
    status: 503,
    description: 'The upstream is unreachable.',
    schema: envelopeSchema(healthResultSchema),
  })
  ready(): Promise<HealthCheckResult> {
    const baseUrl = this.configService.get('http.baseUrl', { infer: true });
    // /posts/1 is a small, always-present resource — a reasonable stand-in
    // for a dedicated health/ping endpoint, which JSONPlaceholder lacks.
    return this.health.check([
      () => this.http.pingCheck('upstream', `${baseUrl}/posts/1`),
    ]);
  }
}
