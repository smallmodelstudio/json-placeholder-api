import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
  type DataPoint,
  type ScopeMetrics,
  type SumMetricData,
} from '@opentelemetry/sdk-metrics';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let provider: MeterProvider;
  let reader: PeriodicExportingMetricReader;

  beforeEach(() => {
    const exporter = new InMemoryMetricExporter(
      AggregationTemporality.CUMULATIVE,
    );
    // Long enough that the periodic export timer never actually fires during
    // a test; `reader.collect()` is called directly instead.
    reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 3_600_000,
    });
    provider = new MeterProvider({ readers: [reader] });
    metrics.setGlobalMeterProvider(provider);
  });

  afterEach(async () => {
    metrics.disable();
    await provider.shutdown();
  });

  async function dataPointsFor(
    name: string,
  ): Promise<Array<DataPoint<number>>> {
    const { resourceMetrics } = await reader.collect();
    const scopeMetrics: ScopeMetrics[] = resourceMetrics.scopeMetrics;
    const metric = scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((candidate) => candidate.descriptor.name === name);
    // Every metric MetricsService records is a Counter, i.e. Sum data —
    // this cast is safe for this spec's fixed set of metric names.
    return (metric as SumMetricData | undefined)?.dataPoints ?? [];
  }

  it('records cache lookups as a counter labeled by result', async () => {
    const service = new MetricsService();

    service.recordCacheLookup('hit');
    service.recordCacheLookup('miss');
    service.recordCacheLookup('hit');

    const points = await dataPointsFor('http_cache_lookups_total');
    const hit = points.find((point) => point.attributes['result'] === 'hit');
    const miss = points.find((point) => point.attributes['result'] === 'miss');

    expect(hit?.value).toBe(2);
    expect(miss?.value).toBe(1);
  });

  it('records upstream retries as a counter', async () => {
    const service = new MetricsService();

    service.recordUpstreamRetry();
    service.recordUpstreamRetry();

    const [point] = await dataPointsFor('upstream_retries_total');
    expect(point?.value).toBe(2);
  });

  it('records throttle rejections as a counter', async () => {
    const service = new MetricsService();

    service.recordThrottleRejection();

    const [point] = await dataPointsFor('throttle_rejections_total');
    expect(point?.value).toBe(1);
  });
});
