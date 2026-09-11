// Loaded via `node --import` (see package.json's start:prod and Dockerfile's
// CMD) *before* Nest — or anything else — is required. Loading it from
// main.ts instead would be too late: Axios and Node's http module are
// already required by the time main.ts's own imports run, and OTel's
// auto-instrumentation works by patching a module the first time it's
// require()'d, so a late import means the patches simply never apply.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

// No explicit `url` on either exporter: both fall back to the standard
// OTEL_EXPORTER_OTLP_ENDPOINT (or the more specific *_TRACES_/*_METRICS_
// variant) env var, defaulting to http://localhost:4318 when unset — set by
// docker-compose.yml/k8s to point at the otel-lgtm collector.
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]:
      process.env['OTEL_SERVICE_NAME'] ?? 'json-placeholder-api',
    [ATTR_SERVICE_VERSION]: process.env['npm_package_version'] ?? '0.0.0',
  }),
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Filesystem instrumentation is noisy (every dotenv/config read
      // becomes a span) and tells us nothing about this app's actual
      // bottleneck, which is the upstream HTTP call (see UpstreamService).
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // Log *correlation* (trace_id/span_id injected into pino lines) stays
      // on; log *sending* (mirroring pino output to the OTel Logs API) is
      // off — logs stay on stdout, with no OTLP logs pipeline.
      '@opentelemetry/instrumentation-pino': { disableLogSending: true },
    }),
  ],
});

sdk.start();

// Terminus's shutdown hook (app.enableShutdownHooks(), app.module.ts) drains
// the app itself; this drains the last batch of spans/metrics so a request
// handled right before shutdown isn't lost.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    void sdk.shutdown();
  });
}
