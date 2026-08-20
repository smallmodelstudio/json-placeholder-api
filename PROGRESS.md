# NestJS Proxy API — Progress Ledger

## Current Phase

**Phase 6: Production hardening** (Next)

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

### [x] Phase 4: Writes on Posts

* **Dependency:** Installed `@nestjs/swagger` (`^11.4.7`) — not for docs yet (that's Phase 7), just for its `PartialType` mapped-type helper.
* **DTOs:**
  * `src/modules/posts/dto/create-post.dto.ts`: `title`/`body` (`@IsString @IsNotEmpty`), `userId` (`@Type(() => Number) @IsInt @IsPositive`) — same explicit-`@Type` style as `QueryPostsDto`, even though the global `ValidationPipe`'s `enableImplicitConversion` would likely cover a JSON-body number too; kept for consistency with the existing DTO.
  * `src/modules/posts/dto/update-post.dto.ts`: `UpdatePostDto extends PartialType(CreatePostDto)` — a single DTO reused for both `PUT` and `PATCH`, per the plan. All fields optional; JSONPlaceholder doesn't distinguish full-replace vs partial-update semantics server-side anyway.
* **`PostsService`:** added `create` (`upstream.post`), `update` (`upstream.put`), `patch` (`upstream.patch`), `remove` (`upstream.delete`) — all thin passthroughs, consistent with the existing `findAll`/`findOne` style. `remove` returns `Promise<object>` since JSONPlaceholder's `DELETE` responds `200 {}` rather than `204 No Content`, and the response still needs to flow through `TransformInterceptor`'s `{ data, meta }` envelope.
* **`PostsController`:** added `@Post()` (201, `CreatePostDto` body), `@Put(':id')`/`@Patch(':id')` (200, `ParsePositiveIntPipe` id + `UpdatePostDto` body), `@Delete(':id')` (200, `ParsePositiveIntPipe` id). Nest's `Post` decorator is imported as `HttpPost` to avoid colliding with the `Post` entity class name already in scope.
* **Testing & Verification:**
  * Unit tests: `posts.service.spec.ts` and `posts.controller.spec.ts` extended with `create`/`update`/`patch`/`remove` cases (call-contract assertions + error propagation, matching the existing `findAll`/`findOne` pattern) — 58/58 unit tests passing across the project.
  * E2E (`test/posts.e2e-spec.ts`): nocked passthrough for all four write verbs, plus 400s for missing required fields, an unknown/whitelisted-out property (`forbidNonWhitelisted`), a non-positive-integer `:id`, and an invalid field type (`userId: 'not-a-number'`) — 24/24 e2e tests passing.
  * Clean `npm run build` and `npm run lint` (0 errors; same pre-existing `supertest`/`App` `no-unsafe-argument` warnings as prior phases).
  * Live-verified against the real `jsonplaceholder.typicode.com` (`npm run start`, `curl`'d, killed after): confirmed `POST` returns a plausible new resource (`id: 101`), `PUT`/`PATCH`/`DELETE` all return `200` with the expected envelope, and the validation 400 lists field-level messages for a payload missing `body`/`userId`. Confirms the "JSONPlaceholder fakes persistence" behavior firsthand — a `GET` after these writes would not reflect them.
* **README:** added a "Description" section replacing the stock Nest boilerplate line, plus a note that `POST`/`PUT`/`PATCH`/`DELETE` on `/posts` proxy through correctly but JSONPlaceholder doesn't actually persist writes, so it doesn't look like a proxy bug later.

### [x] Phase 5: Remaining Resources + Nested Routes

* **Scope decision (checked with the user before starting):** full CRUD (`GET` list/one + `POST`/`PUT`/`PATCH`/`DELETE`) for all five remaining resources, matching Posts exactly — not read-only. Hand-write each resource longhand rather than extracting a generic base service/controller, per PLAN.md's own caveat that premature generics tend to fight Nest's DI system; the four post-Users resources (Comments/Todos/Albums/Photos) turned out simple and near-identical enough that this held up fine with no abstraction regretted.
* **New modules, each following the exact Posts shape** (`entities/`, `dto/{query,create,update}-*.dto.ts`, `*.service.ts`, `*.controller.ts`, `*.module.ts`, plus `.spec.ts` for service and controller):
  * `src/modules/comments/` — `Comment { id, postId, name, email, body }`. `CreateCommentDto.email` uses `@IsEmail()`.
  * `src/modules/todos/` — `Todo { id, userId, title, completed }`. `CreateTodoDto.completed` uses `@IsBoolean()`.
  * `src/modules/photos/` — `Photo { id, albumId, title, url, thumbnailUrl }`. `CreatePhotoDto.url`/`thumbnailUrl` use `@IsUrl()`.
  * `src/modules/albums/` — `Album { id, userId, title }`.
  * `src/modules/users/` — `User { id, name, username, email, address, phone, website, company }`, with nested `Address { street, suite, city, zipcode, geo }`, `Geo { lat, lng }`, `Company { name, catchPhrase, bs }` classes. First use of nested DTO validation: `CreateUserDto` uses private `GeoDto`/`AddressDto`/`CompanyDto` classes (declared in the same file, not exported — only `CreateUserDto` needs them) with `@ValidateNested() @Type(() => XDto)`. `Geo.lat`/`lng` use `@IsLatitude()`/`@IsLongitude()` (accept JSONPlaceholder's numeric-string format directly). `phone`/`website` deliberately left as plain `@IsString()` rather than stricter validators (`@IsPhoneNumber()`, `@IsUrl()`) since real JSONPlaceholder fixture data (`"1-770-736-8031 x56442"`, `"hildegard.org"` with no protocol) wouldn't pass them.
  * `UpdateXDto = PartialType(CreateXDto)` for every resource, same pattern as `UpdatePostDto`.
* **Nested routes — owned by the parent path's controller, not a separate router:**
  * `GET /posts/:id/comments` on `PostsController`, backed by `PostsService.findComments()` which now takes `CommentsService` as a constructor dependency and delegates to `CommentsService.findAll({ postId })` — reuses the existing query-filter logic rather than duplicating an upstream call.
  * `GET /users/:id/posts`, `GET /users/:id/todos`, `GET /users/:id/albums` on `UsersController`, backed by `UsersService` delegating to `PostsService.findAll({ userId })` / `TodosService.findAll({ userId })` / `AlbumsService.findAll({ userId })` respectively.
  * `GET /albums/:id/photos` on `AlbumsController`, backed by `AlbumsService.findPhotos()` delegating to `PhotosService.findAll({ albumId })`.
  * This makes the module dependency graph a DAG: `PostsModule` imports `CommentsModule`; `AlbumsModule` imports `PhotosModule`; `UsersModule` imports `PostsModule`, `TodosModule`, `AlbumsModule`. Every module that's a nested-route dependency also `exports` its service. `AppModule` imports all six feature modules directly (not relying on transitive re-imports) so route registration doesn't depend on the nested-route wiring staying intact.
  * Route ordering is a non-issue: `:id/comments` (two path segments) never collides with `:id` (one segment) in Nest's underlying path-to-regexp matching, so no explicit ordering care was needed.
* **`Post` decorator/entity name collision:** both `PostsController` and `UsersController` import the `Post` entity class (Users needs it for the `findPosts` nested route) alongside `@nestjs/common`'s `Post` HTTP-method decorator — both import the decorator as `HttpPost`, same fix as Phase 4. No other resource name collides with a Nest decorator.
* **Real bug caught by E2E testing, not just a test-writing mistake:** `@ValidateNested()` alone does **not** enforce that a nested property is present — it only recurses into validating a nested object's own fields *if* the object exists; sending a `CreateUserDto` payload with `address` omitted entirely passed validation and fell through to a real (unmocked) upstream call, which nock correctly rejected as a network error, surfacing as an unexpected 502 in an E2E test that expected 400. Fixed by adding `@IsNotEmptyObject()` ahead of `@ValidateNested()` on `address`, `company` (`CreateUserDto`) and `geo` (`AddressDto`) — confirmed live afterward (`"address must be a non-empty object"`). Worth remembering for any future nested-object DTO: `@ValidateNested()` needs a presence/type check alongside it, it doesn't provide one itself.
* **`enableImplicitConversion` coerces booleans in a way that can silently defeat a negative test:** the global `ValidationPipe`'s implicit conversion runs `Boolean(value)` against any string for a `boolean`-typed field, and `Boolean(x)` is truthy for *every* non-empty string — so `completed: 'yes'` on `CreateTodoDto` doesn't fail `@IsBoolean()`, it gets silently coerced to `true` and passes. There's no string value that can trigger this specific validation failure; the Todos E2E "invalid completed" test was rewritten to omit the field entirely (`undefined` correctly fails `@IsBoolean()` since there's no `@IsOptional()`) rather than sending a bad value for it.
* **Testing & Verification:**
  * Unit tests: full `findAll`/`findOne`/`create`/`update`/`patch`/`remove` coverage for all five new services + controllers, plus dedicated cases for the three new nested-route methods (`PostsService.findComments`, `AlbumsService.findPhotos`, and `UsersService.findPosts`/`findTodos`/`findAlbums`) asserting the delegate-to-sibling-service call contract — 167/167 unit tests passing across the project (up from 61).
  * E2E: `test/{comments,todos,photos,albums}.e2e-spec.ts` (new, one per resource — happy-path CRUD + one representative validation 400 each) and `test/users.e2e-spec.ts` (new — full CRUD, missing-nested-object 400, invalid-lat/lng 400, plus all three nested routes). `test/posts.e2e-spec.ts` extended with `GET /posts/:id/comments`. 77/77 e2e tests passing (up from 24).
  * Clean `npm run build` and `npm run lint` (0 errors; same pre-existing `supertest`/`App` `no-unsafe-argument` warnings as prior phases, now duplicated across the additional e2e spec files).
  * Live-verified against the real `jsonplaceholder.typicode.com` (`npm run start`, `curl`'d, killed after): all five nested-route endpoints return real filtered data; `POST /users` with a full nested address/company payload succeeds and echoes a new `id`; the same payload with `address` omitted returns the expected 400 with `"address must be a non-empty object"`; `DELETE /albums/1` returns `200 {}`.

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

Implement **Phase 6 (Production hardening)**:

* `CacheModule` (`@nestjs/cache-manager`) with a per-route TTL — genuinely justified here since upstream JSONPlaceholder data is static; add cache-hit tests (assert a second request within the TTL doesn't re-hit the nocked upstream).
* `ThrottlerModule` global guard to protect the upstream from being hammered — first Guard in the project.
* `@nestjs/terminus` health check at `/health` using `HttpHealthIndicator` pinging JSONPlaceholder.
* Graceful shutdown hooks.
* Full API surface is now in place (Posts, Users, Comments, Todos, Albums, Photos, all five nested routes) — Phase 6 is about behavior under load, not new resources. Phase 7 (Swagger/docs/polish, contract tests, coverage review) still follows after.
