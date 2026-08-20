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

  @Get()
  // Terminus's own @HealthCheck() would otherwise auto-document a bare
  // HealthCheckResult, but this route flows through the same global
  // TransformInterceptor as everything else — its swagger docs are
  // disabled here in favor of two explicit, envelope-aware responses.
  @HealthCheck({ swaggerDocumentation: false })
  @ApiResponse({
    status: 200,
    description: 'The health check succeeded.',
    schema: envelopeSchema(healthResultSchema),
  })
  @ApiResponse({
    status: 503,
    description: 'The health check failed.',
    schema: envelopeSchema(healthResultSchema),
  })
  check(): Promise<HealthCheckResult> {
    const baseUrl = this.configService.get('http.baseUrl', { infer: true });
    // /posts/1 is a small, always-present resource — a reasonable stand-in
    // for a dedicated health/ping endpoint, which JSONPlaceholder lacks.
    return this.health.check([
      () => this.http.pingCheck('upstream', `${baseUrl}/posts/1`),
    ]);
  }
}
