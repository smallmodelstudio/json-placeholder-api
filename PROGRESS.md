# NestJS Proxy API — Progress Ledger

## Current Phase

**Phase 3: Cross-cutting concerns** (Next)

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

## Active Context & Architectural Decisions

* **Path Aliases Dropped:** Decided against `tsconfig` path aliases (`@common/*`, etc.) to prevent build pipeline fragility with Nest CLI's standard `tsc` compiler. Using clean relative imports instead.
* **Environment Validation:** App fails startup explicitly if environment validation fails.
* **Single timeout mechanism:** Timeout is enforced by axios itself (the `timeout` set on the axios instance in `UpstreamModule`), not by an additional rxjs `timeout()` operator. A timed-out request surfaces as an `AxiosError` with `code === 'ECONNABORTED'`, which `UpstreamService` maps to `UpstreamErrorType.TIMEOUT`. Rationale: one source of truth for the timeout duration instead of two independently-configured timeout mechanisms that could race or drift.
* **`UpstreamException` stays HTTP-agnostic:** It's a plain domain error, not an `HttpException`. Translating `UpstreamErrorType` → HTTP status codes (502/504/etc.) is deferred to the exception filter built in Phase 3, keeping `UpstreamService` free of any HTTP-response concerns.
* **Retry semantics discovered during testing:** `@nestjs/axios`'s `HttpService.request()` wraps every call in `new Observable(subscriber => { axios(...).then(...) })`, so a fresh axios call happens on **every subscription**, not on every call to `.request()`. `retry()` exploits this correctly in production (each retry resubscribes → a genuinely new HTTP call). Unit tests mocking `HttpService` had to account for this: `upstream.service.spec.ts` uses a `respondWith()` helper that returns a custom Observable simulating per-subscription attempts, rather than chaining `mockReturnValueOnce()` on the mock function (which is only ever called once per outer request).

## Next Immediate Task

Implement **Phase 3 (Cross-cutting concerns)**:

* Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`, `enableImplicitConversion`) — once in place, decide whether to remove the route-scoped `ValidationPipe` in `PostsController#findAll` (see Phase 2 notes) since it would become redundant.
* `AllExceptionsFilter` — catch-all producing a consistent error envelope (`statusCode`, `message`, `error`, `path`, `timestamp`, `correlationId`), and specifically translating `UpstreamException` → 502/504/etc. instead of leaking as a bare 500 (current behavior, see Phase 2 notes on `PostsService`).
* Logging / transform / timeout interceptors, correlation-ID middleware.
* Shared `createTestApp()` helper (`test/support/create-test-app.ts`, already scaffolded in Phase 2) should start reflecting real global providers as they're added.
* Unit tests per component + E2E error-path tests (upstream 500 → 502, upstream timeout → 504, unknown route → 404 envelope, validation rejection → 400 with field errors).
