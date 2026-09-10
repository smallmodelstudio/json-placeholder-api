import { Injectable } from '@nestjs/common';
import { metrics, type Counter } from '@opentelemetry/api';

// `metrics.getMeter()` returns a real Meter once instrumentation.ts's
// NodeSDK has registered a MeterProvider (production/Docker/k3d), and a
// no-op Meter otherwise (unit/e2e tests, or `nest start` without the
// `--import` flag) — so every method here is always safe to call.
@Injectable()
export class MetricsService {
  private readonly meter = metrics.getMeter('json-placeholder-api');

  private readonly cacheLookups: Counter = this.meter.createCounter(
    'http_cache_lookups_total',
    { description: 'HttpCacheInterceptor lookups, labeled by result' },
  );

  private readonly upstreamRetries: Counter = this.meter.createCounter(
    'upstream_retries_total',
    {
      description: 'Retries issued against the upstream API by UpstreamService',
    },
  );

  private readonly throttleRejections: Counter = this.meter.createCounter(
    'throttle_rejections_total',
    { description: 'Requests rejected by ThrottlerGuard' },
  );

  recordCacheLookup(result: 'hit' | 'miss'): void {
    this.cacheLookups.add(1, { result });
  }

  recordUpstreamRetry(): void {
    this.upstreamRetries.add(1);
  }

  recordThrottleRejection(): void {
    this.throttleRejections.add(1);
  }
}
