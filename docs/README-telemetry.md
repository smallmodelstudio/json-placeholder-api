# Telemetry

The traces, metrics and logs the app emits, and how to view them.

## Signals

| Signal | Source | Destination |
| --- | --- | --- |
| Traces | OpenTelemetry auto-instrumentation | OTLP endpoint |
| Metrics | Auto-instrumentation plus three custom counters | OTLP endpoint |
| Logs | `nestjs-pino`, one JSON line per event, carrying `trace_id` and `span_id` | stdout |

Everything is exported over OTLP, the vendor-neutral protocol, so switching to a
different backend only means changing the endpoint.

## How it loads

`src/instrumentation.ts` starts the OpenTelemetry SDK. It has to run before any
other module loads: auto-instrumentation works by patching `http`, axios and the
rest the first time they're `require`d. Importing it from `main.ts` would be too
late.

| Start command | Telemetry |
| --- | --- |
| `npm run start:prod`, Docker, k3d | On, loaded with `node --import` |
| `npm run start`, `start:dev`, tests | Off. The OpenTelemetry API falls back to no-ops, so the app runs unchanged |

## Correlation

When a request arrives without an `x-correlation-id` header, its correlation ID
is set to the active trace ID. The same value then appears in the response
header, in `meta.correlationId`, in every log line for the request, and in the
trace. If the client sends its own `x-correlation-id`, that value is used
instead and won't match the trace ID. Without telemetry, the ID is a random UUID.

## Custom metrics

| Metric | Counts | Recorded in |
| --- | --- | --- |
| `http_cache_lookups_total{result="hit\|miss"}` | Cache lookups | `HttpCacheInterceptor` |
| `upstream_retries_total` | Upstream retries | `UpstreamService` |
| `throttle_rejections_total` | Requests rejected with 429 | `AllExceptionsFilter` |

## Configuration

| Variable | Default | Set to |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | `http://otel:4318` in compose; `http://otel-lgtm:4318` in the k3d overlay |
| `OTEL_SERVICE_NAME` | `json-placeholder-api` | — |

These are standard OpenTelemetry variables, read by the SDK directly rather than
through `src/config`.

Log level: `debug` in development, `info` in production, `silent` in tests.

## Viewing

The local backend is `grafana/otel-lgtm`, a single container that bundles an
OpenTelemetry Collector with Grafana, Tempo (traces), Prometheus (metrics) and
Loki (logs).

```bash
# Docker Compose
docker compose up --build
# Grafana: http://localhost:3001 (admin / admin) → Explore

# k3d; the local overlay deploys otel-lgtm next to the app
kubectl port-forward svc/otel-lgtm 3001:3000
# Grafana: http://localhost:3001
```

Grafana is on port 3001 because the app already uses 3000.

## Gotchas

- **Choose the log format by checking whether `pino-pretty` is installed, not by
  `NODE_ENV`.** `pino-pretty` is a devDependency, so it isn't in the production
  image, and pino throws on boot if a transport can't be found. The k3d overlay
  runs that image with `NODE_ENV=development`, so a `NODE_ENV` check
  crash-loops the pod. `isPinoPrettyAvailable()` in `app.module.ts` checks
  whether the module resolves instead.
- **Don't register the HTTP or Nest instrumentations separately.**
  `getNodeAutoInstrumentations()` already includes them, and registering them
  again produces duplicate spans.
- **Filesystem instrumentation is disabled** because it creates noisy spans that
  say nothing about a proxy.
- **Pino logs aren't sent over OTLP.** They stay on stdout; only the trace
  correlation fields are added.
- **The prod overlay has no telemetry backend.** Its endpoint stays at the
  default, so exports fail quietly and the app keeps running.
