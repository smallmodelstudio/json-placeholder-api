import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { AppConfig } from '../config/config.types';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    const baseUrl = this.configService.get('http.baseUrl', { infer: true });
    // /posts/1 is a small, always-present resource — a reasonable stand-in
    // for a dedicated health/ping endpoint, which JSONPlaceholder lacks.
    return this.health.check([
      () => this.http.pingCheck('upstream', `${baseUrl}/posts/1`),
    ]);
  }
}
