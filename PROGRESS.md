# NestJS Proxy API — Progress Ledger

## Current Phase

**Phase 4: Writes on Posts** (Next)

## Completed Phases

### [x] Phase 0: Foundation

* **Build Changes:**
  * Enabled strict TypeScript mode (`strict: true` in `tsconfig.json`).
  * Installed dependencies: `@nestjs/config`, `@nestjs/axios`, `axios`, `class-validator`, `class-transformer`.
  * Removed initial boilerplate (`app.controller.ts`, `app.service.ts`).
* **Configuration Setup:**
  * `src/config/config.types.ts`: Typed `AppConfig` interfaces.
  * `src/config/env.validation.ts`: Class-validator schema for process environment.
  * `src/config/configuration.ts`: Configuration factory.
  * `.env` / `.env.example`: Environment templates created.
* **Core Application Setup:**
  * `src/app.module.ts`: Global `ConfigModule.forRoot` wired up.
  * `src/main.ts`: Configured to pull port dynamic settings via typed `ConfigService`.
* **Testing & Verification:**
  * Unit tests (`src/config/env.validation.spec.ts`): 6/6 passing.
  * E2E tests (`test/app.e2e-spec.ts`): 1/1 passing.
  * Verified build (`npm run build`) and runtime crash prevention on invalid `NODE_ENV`.

### [x] Phase 1: The Upstream Client

* **Domain Error Type:**
  * `src/common/exceptions/upstream.exception.ts`: `UpstreamException` (plain `Error` subclass, deliberately **not** an `HttpException`) with an `UpstreamErrorType` enum (`TIMEOUT`, `NETWORK_ERROR`, `BAD_RESPONSE`), an optional `upstreamStatus`, and the original error preserved via the native `Error` `cause` chain.
* **Upstream Module & Service:**
  * `src/upstream/upstream.module.ts`: `HttpModule.registerAsync` builds the axios instance from `ConfigService` (`http.baseUrl`, `http.timeoutMs`) — no hardcoded upstream URL anywhere in the app.
  * `src/upstream/upstream.service.ts`: Typed `get/post/put/patch/delete<T>()` verbs, all routed through a private `request()` that:
    * uses `firstValueFrom` to bridge the Observable back to a `Promise<T>`;
    * retries via rxjs `retry({ count, delay })` with exponential backoff (`100ms * 2^(attempt-1)`), retrying on 5xx responses and on connection-level errors (no `response` at all), but **not** on 4xx;
    * maps every terminal failure to an `UpstreamException` via `catchError`, preserving the upstream status code where one exists.
  * `src/upstream/interfaces/upstream-request.interface.ts`: `UpstreamRequestOptions` (`params`, `headers`) shared by all verbs.
  * Wired into `src/app.module.ts`.
* **Testing & Verification:**
  * Unit tests (`src/upstream/upstream.service.spec.ts`): 9/9 passing — success passthrough, params/body forwarding, retry-then-succeed on 5xx, no-retry on 4xx, retry exhaustion mapped to `UpstreamException`, network-error and timeout mapping, status-code preservation, non-axios error mapping.
  * Full suite: 15/15 unit tests, 1/1 e2e test, clean `build` and `lint`.
  * Live-verified against the real `jsonplaceholder.typicode.com` (not just mocks) with a throwaway script: confirmed `GET /posts/1` passthrough and `GET /posts/999999` → `UpstreamException` with `upstreamStatus: 404`. Script deleted after verification — not part of the codebase.

### [x] Phase 2: First Vertical Slice (Posts, read-only)

* **`PostsModule`:** `src/modules/posts/` — imports `UpstreamModule`, wired into `AppModule`.
* **Entity:** `src/modules/posts/entities/post.entity.ts` — plain class (`id`, `userId`, `title`, `body`) with definite-assignment (`!`) fields, since instances come from parsed upstream JSON rather than `new Post()` construction. No Swagger decorators yet — deferred to Phase 7.
* **`QueryPostsDto`:** `src/modules/posts/dto/query-posts.dto.ts` — optional `userId` (`@IsOptional @Type(() => Number) @IsInt @IsPositive`), validated/transformed by a **route-scoped** `new ValidationPipe({ transform: true, whitelist: true })` on `@Query()` in the controller. There is no global `ValidationPipe` yet (that's Phase 3), so this pipe instance is deliberately local to `PostsController#findAll` for now; it can likely be removed once the global pipe lands, since a global `ValidationPipe` would cover the same DTO.
* **`ParsePositiveIntPipe`:** `src/common/pipes/parse-positive-int.pipe.ts` — hand-written custom pipe (learning goal, per plan) for the `:id` param; rejects non-integers, zero, and negatives with a `BadRequestException`. Handled natively by Nest's default exception filter (no custom filter exists yet), so it already returns a proper 400 JSON body.
* **`PostsController` / `PostsService`:** `GET /posts` (optionally filtered by `?userId=`, passed through to upstream as a query param) and `GET /posts/:id`. Service is a thin passthrough to `UpstreamService.get()` — no error handling in the service itself, since `UpstreamException` mapping to HTTP responses is explicitly deferred to the Phase 3 exception filter. Right now an upstream 404/500 surfaces as an unhandled `UpstreamException` → Nest's default filter → 500, which is expected/known until Phase 3.
* **Test support pattern (for all future E2E specs):**
  * `test/support/create-test-app.ts` — shared `createTestApp()` bootstrap (mirrors `main.ts`; will matter once Phase 3 adds global pipes/filters). `test/app.e2e-spec.ts` refactored to use it.
  * `test/support/upstream-mock.ts` — `mockUpstream()` nock scope helper, bound to `UPSTREAM_BASE_URL`.
  * `test/support/nock-setup.ts` — registered via `setupFilesAfterEnv` in `test/jest-e2e.json`; calls `nock.disableNetConnect()` then `nock.enableNetConnect('127.0.0.1')` so unmocked upstream calls fail loudly while supertest's own loopback traffic to the app still works (blocking `127.0.0.1` too was an early gotcha — it broke supertest itself, not just real upstream calls). `nock.cleanAll()` after each test.
* **Testing & Verification:**
  * Unit tests: `parse-positive-int.pipe.spec.ts`, `posts.service.spec.ts`, `posts.controller.spec.ts` — 30/30 total unit tests passing across the project.
  * E2E tests (`test/posts.e2e-spec.ts`): happy path for `GET /posts`, `?userId=` passthrough, `GET /posts/:id`, plus 400s from both the query DTO and `ParsePositiveIntPipe` — 6/6 e2e tests passing.
  * Clean `npm run build` and `npm run lint` (0 errors; pre-existing `no-unsafe-argument` warnings only, on `supertest`'s `App` type — consistent with the rest of the test suite).
  * Installed `nock` as a dev dependency.

### [x] Phase 3: Cross-cutting Concerns

* **Everything lives in `AppModule`, not `main.ts`:** global `ValidationPipe`, `AllExceptionsFilter`, and the three interceptors are registered as `APP_PIPE`/`APP_FILTER`/`APP_INTERCEPTOR` providers inside `src/app.module.ts`, and `CorrelationIdMiddleware` is wired via `AppModule.configure()`. `main.ts` is unchanged — still just `NestFactory.create(AppModule)` + `app.listen()`. This means `test/support/create-test-app.ts` (`Test.createTestingModule({ imports: [AppModule] })` + `createNestApplication()` + `.init()`) automatically inherits every global provider identically to production, by construction — no manual mirroring between `main.ts` and the test helper is needed (stronger than the plan's literal ask to "update `createTestApp()` to mirror `main.ts`": there's nothing left to mirror, since both bootstrap paths converge on the same `AppModule`).
* **Global `ValidationPipe`:** `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `transformOptions: { enableImplicitConversion: true }`. The route-scoped pipe on `PostsController#findAll` (Phase 2 stopgap) is removed — `@Query() query: QueryPostsDto` now relies entirely on the global pipe. Confirmed the global pipe correctly no-ops on `@Param('id', ParsePositiveIntPipe) id: number` (primitive-typed params are skipped by `ValidationPipe`'s `toValidate()`), so it composes cleanly with the custom pipe rather than conflicting with it.
* **`AllExceptionsFilter`** (`src/common/filters/all-exceptions.filter.ts`): single `@Catch()` filter (no separate `UpstreamExceptionFilter` — PLAN.md listed that as "optional," and folding the `UpstreamException` handling into one filter avoids filter-ordering pitfalls). Envelope shape: `{ statusCode, message, error, path, timestamp, correlationId }`. Resolution logic:
  * `UpstreamException` with `type: TIMEOUT` → 504 Gateway Timeout, always.
  * `UpstreamException` with a 4xx `upstreamStatus` → passed through unchanged (e.g. upstream 404 stays 404 — meaningful to our own clients, not just a proxy failure).
  * Any other `UpstreamException` (5xx `upstreamStatus`, or `NETWORK_ERROR` with no `upstreamStatus` at all) → 502 Bad Gateway.
  * Any other `HttpException` (validation errors, `ParsePositiveIntPipe`'s `BadRequestException`, Nest's own unmatched-route 404) → formatted from its own `getStatus()`/`getResponse()`.
  * Anything else (unexpected error) → generic 500, with the real error logged server-side via `Logger.error` but never leaked into the response body.
  * Server errors (5xx) are logged; 4xx are not (expected client-caused noise).
* **Interceptors**, bound globally in this order — `[Logging, Transform, Timeout]` — chosen deliberately for the onion-model execution order: Timeout ends up closest to the actual handler (correctly races the real work), Transform wraps the raw result into the envelope next, Logging is outermost so its duration measurement covers the whole request:
  * `LoggingInterceptor` (`src/common/interceptors/logging.interceptor.ts`) — logs method/path/duration/correlationId on success (`Logger.log`) or the error message on failure (`Logger.warn`). Deliberately does **not** log `response.statusCode`: Nest doesn't actually set that on the raw `Response` object until *after* the interceptor chain resolves, so reading it here would silently be stale/misleading.
  * `TransformInterceptor` (`src/common/interceptors/transform.interceptor.ts`) — wraps every successful response in `{ data, meta: { timestamp, correlationId } }`. This changes the shape of every existing success response (see `posts.e2e-spec.ts` updates below).
  * `TimeoutInterceptor` (`src/common/interceptors/timeout.interceptor.ts`) — rxjs `timeout()` → `GatewayTimeoutException` (504). **Reconciles with the Phase 1 "single timeout mechanism" decision**: this is a different concern, not a duplicate. Axios's own timeout (Phase 1) remains the authoritative, primary mechanism for upstream-latency 504s. This interceptor is a wider backstop covering the *whole* request lifecycle (in-process work, future multi-call routes), sized via `timeoutMs * (maxRetries + 2)` — one full extra `timeoutMs` of headroom beyond `UpstreamService`'s own worst case (`timeoutMs * (maxRetries + 1)` plus negligible backoff), so under normal conditions the axios-level timeout always fires first and this only catches requests stuck for some other reason.
* **`CorrelationIdMiddleware`** (`src/common/middleware/correlation-id.middleware.ts`): reuses an incoming `x-correlation-id` request header if present and non-blank, otherwise generates one via `crypto.randomUUID()`; always echoes it back on the response header. Applied via `consumer.apply(CorrelationIdMiddleware).forRoutes('*')` — runs for every request, including ones that hit no matching route, so `AllExceptionsFilter`'s unmatched-route 404 envelope always has a real `correlationId`. Required a small `declare global { namespace Express { interface Request { correlationId: string } } }` augmentation (`src/common/types/express.d.ts`) since this is a custom property on Express's `Request`.
* **Testing & Verification:**
  * Unit tests: `all-exceptions.filter.spec.ts`, `logging.interceptor.spec.ts`, `transform.interceptor.spec.ts`, `timeout.interceptor.spec.ts`, `correlation-id.middleware.spec.ts` — 46/46 total unit tests passing across the project.
  * E2E: `test/errors.e2e-spec.ts` (new) covers the full cross-cutting surface — success envelope shape, correlation-id echo/generation, 400 validation envelope with field-level `message` array, upstream 500 → 502, upstream timeout → 504, upstream 404 passthrough, unknown route → 404 envelope. `test/posts.e2e-spec.ts` updated to assert `response.body.data` instead of the raw payload, since `TransformInterceptor` now wraps every success response. 14/14 e2e tests passing.
  * **nock gotcha:** `replyWithError({ code: 'ECONNABORTED' })` hangs indefinitely under the installed nock version (14.x, MSW-interceptor-based) — confirmed via a throwaway script before spending time debugging it in Jest. Used `.delayConnection(ms)` against a short, test-local axios timeout instead, which reliably produces a genuine `ECONNABORTED` — this is the pattern the timeout E2E test uses.
  * **Env override for a fast timeout E2E test:** the real `.env` timeout/retry values would make a true end-to-end timeout test slow (worst case ~15s+ with defaults). `test/support/with-env-overrides.ts` temporarily overrides `process.env.UPSTREAM_TIMEOUT_MS`/`UPSTREAM_MAX_RETRIES` for the duration of one test, restoring them after. Works because `@nestjs/config`'s dotenv loading never overrides a key already present in `process.env`, and each `createTestApp()` call re-instantiates `ConfigModule` fresh — so setting the override *before* calling `createTestApp()` inside the callback wins.
  * Clean `npm run build` and `npm run lint` (0 errors). Fixing lint cleanly (not just suppressing) surfaced a few real TS-strictness patterns worth remembering: `expect.any(X)` used as an *object-literal property value* trips `no-unsafe-assignment` (its declared return type is `any`) even though the same matcher passed directly as a bare argument to `toEqual`/`toHaveBeenCalledWith` is fine (governed by `no-unsafe-argument`, downgraded to `warn` in this project's eslint config) — the fix is asserting dynamic fields (`timestamp`, `correlationId`) as separate standalone `expect(...)` calls rather than embedding them in `objectContaining`/`toMatchObject`. Comparing a plain `number` against an `HttpStatus` enum member with `>=` trips `no-unsafe-enum-comparison`; an inline `as number` cast gets stripped right back out by `no-unnecessary-type-assertion`'s autofix, so the working fix is a module-level `const` explicitly typed `number`.
  * Live-verified against the real `jsonplaceholder.typicode.com` (started the app with `npm run start`, `curl`'d it, killed it after): confirmed the `{data, meta}` envelope, upstream-404 passthrough, unmatched-route 404 envelope, validation-rejection 400 with field messages, and correlation-id echo/generation all behave as intended outside of mocks too.

## Active Context & Architectural Decisions

* **Path Aliases Dropped:** Decided against `tsconfig` path aliases (`@common/*`, etc.) to prevent build pipeline fragility with Nest CLI's standard `tsc` compiler. Using clean relative imports instead.
* **Environment Validation:** App fails startup explicitly if environment validation fails.
* **Single timeout mechanism:** Timeout is enforced by axios itself (the `timeout` set on the axios instance in `UpstreamModule`), not by an additional rxjs `timeout()` operator. A timed-out request surfaces as an `AxiosError` with `code === 'ECONNABORTED'`, which `UpstreamService` maps to `UpstreamErrorType.TIMEOUT`. Rationale: one source of truth for the timeout duration instead of two independently-configured timeout mechanisms that could race or drift.
* **`UpstreamException` stays HTTP-agnostic:** It's a plain domain error, not an `HttpException`. Translating `UpstreamErrorType` → HTTP status codes is `AllExceptionsFilter`'s job (Phase 3, now built), keeping `UpstreamService` free of any HTTP-response concerns.
* **Retry semantics discovered during testing:** `@nestjs/axios`'s `HttpService.request()` wraps every call in `new Observable(subscriber => { axios(...).then(...) })`, so a fresh axios call happens on **every subscription**, not on every call to `.request()`. `retry()` exploits this correctly in production (each retry resubscribes → a genuinely new HTTP call). Unit tests mocking `HttpService` had to account for this: `upstream.service.spec.ts` uses a `respondWith()` helper that returns a custom Observable simulating per-subscription attempts, rather than chaining `mockReturnValueOnce()` on the mock function (which is only ever called once per outer request).
* **Global providers live in `AppModule`, not `main.ts`:** all cross-cutting pipes/filters/interceptors/middleware are registered inside `AppModule` itself (`APP_PIPE`/`APP_FILTER`/`APP_INTERCEPTOR` tokens, `configure()` for middleware) rather than via `app.useGlobalXxx()` calls in `main.ts`. Since both `main.ts` and `test/support/create-test-app.ts` just bootstrap `AppModule`, this guarantees they behave identically by construction — there's no second place that can drift out of sync.
* **Two timeout mechanisms, not a conflict:** the Phase 1 "single timeout mechanism" decision was about not double-configuring the *upstream call's own* timeout. The Phase 3 `TimeoutInterceptor` is a different, wider concern — a request-lifecycle backstop — sized (`timeoutMs * (maxRetries + 2)`) to always exceed `UpstreamService`'s own worst case, so it only fires for genuinely stuck requests, not upstream latency (which axios's own timeout continues to own).
* **One exception filter, not two:** PLAN.md listed `upstream-exception.filter.ts` as an optional second filter. Folded `UpstreamException` handling into `AllExceptionsFilter` directly instead — avoids Nest's multi-filter ordering/matching semantics for no real benefit at this scale.

## Next Immediate Task

Implement **Phase 4 (Writes on Posts)**:

* `POST`/`PUT`/`PATCH`/`DELETE` on `/posts`, with `CreatePostDto` and `UpdatePostDto` (the latter via `PartialType(CreatePostDto)` — first use of `@nestjs/swagger`'s mapped types, so `@nestjs/swagger` needs installing even though Swagger docs themselves are still Phase 7).
* Note in the README that JSONPlaceholder fakes persistence (writes succeed but don't actually persist upstream) so behavior doesn't look like a bug later.
* E2E 400s proving the new DTOs are validated (relying on the global `ValidationPipe` from Phase 3 — no new pipe wiring needed).
* Decide whether write methods need any special `UpstreamException`/`AllExceptionsFilter` handling beyond what Phase 3 already covers (e.g. is there a write-specific upstream failure mode worth a distinct status code), or whether the existing 502/504/passthrough logic already covers it as-is.
