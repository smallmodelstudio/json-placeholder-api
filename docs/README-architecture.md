# Architecture

How a request moves through the NestJS app, and where each concern lives.

## Layout

```text
src/
  main.ts                 bootstrap: Fastify adapter, pino logger, Swagger, listen
  bootstrap.ts            shared between main.ts and test/support/create-test-app.ts
  app.module.ts           root module; registers every global pipe, guard, interceptor, filter
  instrumentation.ts      OpenTelemetry SDK, loaded before the app (see Telemetry)
  config/                 env → typed AppConfig, plus startup validation
  upstream/               UpstreamService: the only code that makes HTTP calls
  modules/<resource>/     one module per resource
    entities/             response shapes (zod schemas)
    dto/                  query, create and update inputs (zod schemas)
    <resource>.controller.ts
    <resource>.service.ts
  common/
    hooks/                Fastify onRequest hook that sets the correlation ID
    interceptors/         envelope, cache, timeout
    filters/              AllExceptionsFilter: the error envelope
    pipes/                ZodValidationPipe (global) and ParsePositiveIntPipe for :id params
    validation/           shared zod field schemas (common/validation/fields.ts)
    decorators/           Swagger decorators for the response envelope
    exceptions/           UpstreamException
    metrics/              custom OpenTelemetry counters
  health/                 /health/live and /health/ready
```

Unit specs sit next to the file they test (`*.spec.ts`).

## Request lifecycle

```text
onRequest hook          set correlationId (validated/bounded, else generated); echo it in x-correlation-id
pino-http               access log: method, URL, status, duration, correlationId
ThrottlerGuard          429 when the client IP is over its limit
TransformInterceptor    wrap the handler's result in { data, meta }
HttpCacheInterceptor    serve cached GETs; a hit skips everything below
TimeoutInterceptor      504 if the request outlives its budget
ZodValidationPipe       validate and transform query and body against zod DTOs
Controller → Service → UpstreamService → JSONPlaceholder

Any exception at any step → AllExceptionsFilter → error envelope
```

The pipe, guard, interceptors and filter are registered as `APP_*` providers in
`AppModule`, not in `main.ts`. Tests boot `AppModule` directly, so they run the
same chain as production.

Interceptors wrap each other in the order they're registered, with the first
registered outermost. That order is deliberate: `Transform` sits outside `Cache`,
so a cached response still gets a fresh `timestamp` and `correlationId`.

Per-request access logging is pino-http's job (the `pinoHttp` option on
`LoggerModule.forRootAsync` in `app.module.ts`), not an interceptor's — it's
the only thing that fires for every request, matched route or not, the same
reason `registerCorrelationIdHook` is a Fastify hook rather than an
interceptor. `customLogLevel` there mirrors an error response's severity
(info/warn/error by status code) and `customProps` tags each line with the
same `correlationId` as the response envelope. `AllExceptionsFilter` logs a
5xx a second time, with the stack trace the access log line doesn't carry.

## Response shapes

Success:

```json
{
  "data": { "id": 1, "title": "…" },
  "meta": { "timestamp": "…", "correlationId": "…" }
}
```

Error:

```json
{
  "statusCode": 404,
  "message": "…",
  "error": "Not Found",
  "path": "/posts/999",
  "timestamp": "…",
  "correlationId": "…"
}
```

How `AllExceptionsFilter` maps each kind of error:

| Cause                                      | Status                   |
| ------------------------------------------ | ------------------------ |
| `HttpException`, e.g. a validation failure | Its own status           |
| Upstream timeout                           | 504                      |
| Upstream 4xx                               | Passed through unchanged |
| Upstream 5xx, or no response               | 502                      |
| Anything else                              | 500                      |

## Modules

Every resource has the same shape: `entities/`, `dto/`, a service and a
controller. Each one is written out by hand rather than derived from a generic
base class.

- **Services** call `UpstreamService`, never `HttpService` directly.
- **Nested routes** (`/posts/:id/comments`, `/users/:id/posts`) belong to the
  parent's controller, which delegates to the child's service.
- **`UpstreamService`** retries on 5xx and network errors with exponential backoff
  (100 ms, 200 ms, …). It never retries a 4xx, and never retries a non-idempotent
  method (POST, PATCH) — doing so risks a duplicate write if the first attempt
  actually reached upstream but its response didn't reach us. It turns axios
  errors into `UpstreamException`, which the filter then maps to an HTTP status.

## Cross-cutting concerns

| Concern       | Behaviour                                                                                                                                                                                                                                                                           | Where                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Validation    | Unknown properties or query params return 400; body numbers must be JSON numbers; query integers must be plain digits; URLs must be http or https; a `@Body()`/`@Query()` argument without a zod DTO returns 500                                                                    | `zod-validation.pipe.ts`, `common/validation/fields.ts` |
| Caching       | GETs cached by URL for `CACHE_TTL_MS`; `@CacheTTL()` overrides per route; `X-Cache: HIT` or `MISS` header; `/health/*` never cached                                                                                                                                                 | `http-cache.interceptor.ts`                             |
| Rate limiting | `THROTTLE_LIMIT` requests per `THROTTLE_TTL_MS` per IP (the real client IP only if `TRUST_PROXY=true`, see [Getting started](README-getting-started.md)); `/health/*` exempt via `@SkipThrottle()`                                                                                  | `ThrottlerGuard`                                        |
| Timeouts      | axios aborts each upstream attempt after `UPSTREAM_TIMEOUT_MS`; `TimeoutInterceptor` caps the whole request at `UPSTREAM_TIMEOUT_MS × (UPSTREAM_MAX_RETRIES + 2)`                                                                                                                   | `upstream.module.ts`, `timeout.interceptor.ts`          |
| Health        | `/health/live` checks nothing, so it only fails if the process is down; `/health/ready` pings the upstream and returns 503 if it's unreachable                                                                                                                                      | `health.controller.ts`                                  |
| Config        | `configuration.ts` maps env vars to `AppConfig`; read them with `ConfigService<AppConfig, true>` and `{ infer: true }`                                                                                                                                                              | `src/config/`                                           |
| API docs      | `createZodDto` classes provide the request/response schemas; `cleanupOpenApiDoc()` in `main.ts` post-processes the generated document; no CLI plugin; `@ApiEnvelopedResponse()` documents the success envelope, `@ApiCommonErrorResponses()` the 400/404/429/502/504 error envelope | `main.ts`, `common/decorators/`                         |

## Gotchas

- **The correlation ID is set by a Fastify hook, not a Nest middleware or
  interceptor.** Interceptors only run once a route matches, so a 404 would have
  no ID. Under Fastify, Nest middleware receives the raw Node request, not the
  `FastifyRequest` that everything downstream reads — so the id is stashed on
  both (see `correlation-id.hook.ts`), and pino-http's access log reads its
  copy off the raw request. Because the hook lives outside Nest, `main.ts` and
  `test/support/create-test-app.ts` both have to call it, plus build the same
  `FastifyAdapter`; `src/bootstrap.ts` is the shared code both call into so
  the two can't drift apart by hand. An incoming `x-correlation-id` is only
  reused if it's a non-empty string of up to 128 characters from
  `[A-Za-z0-9_-]` (see `isValidCorrelationId` in `correlation-id.hook.ts`) —
  anything else is replaced with a generated id, the same as a missing
  header, so a client can't smuggle log-line-breaking or oversized values
  into every log line and the response envelope for the request.
- **An undeclared query param returns 400**, because every request schema is a
  `z.strictObject`. Every new query param needs a field on its DTO's schema.
- **Fastify's `request.url` includes the query string.** The cache interceptor
  checks the route pattern (`request.routeOptions.url`) to exclude `/health`.
- **List endpoints aren't paginated.** They return the full upstream list, and
  query DTOs only support filters such as `?userId=`.
- **Build fields from `common/validation/fields.ts`, not `z.coerce`.**
  `z.coerce.number()` accepts hex and exponential-notation strings, the same
  looseness `positiveIntQuery` exists to reject.
