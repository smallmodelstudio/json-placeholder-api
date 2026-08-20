# NestJS Proxy API — Progress Ledger

## Current Phase

**Phase 2: First Vertical Slice (Posts, read-only)** (Next)

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

## Active Context & Architectural Decisions

* **Path Aliases Dropped:** Decided against `tsconfig` path aliases (`@common/*`, etc.) to prevent build pipeline fragility with Nest CLI's standard `tsc` compiler. Using clean relative imports instead.
* **Environment Validation:** App fails startup explicitly if environment validation fails.
* **Single timeout mechanism:** Timeout is enforced by axios itself (the `timeout` set on the axios instance in `UpstreamModule`), not by an additional rxjs `timeout()` operator. A timed-out request surfaces as an `AxiosError` with `code === 'ECONNABORTED'`, which `UpstreamService` maps to `UpstreamErrorType.TIMEOUT`. Rationale: one source of truth for the timeout duration instead of two independently-configured timeout mechanisms that could race or drift.
* **`UpstreamException` stays HTTP-agnostic:** It's a plain domain error, not an `HttpException`. Translating `UpstreamErrorType` → HTTP status codes (502/504/etc.) is deferred to the exception filter built in Phase 3, keeping `UpstreamService` free of any HTTP-response concerns.
* **Retry semantics discovered during testing:** `@nestjs/axios`'s `HttpService.request()` wraps every call in `new Observable(subscriber => { axios(...).then(...) })`, so a fresh axios call happens on **every subscription**, not on every call to `.request()`. `retry()` exploits this correctly in production (each retry resubscribes → a genuinely new HTTP call). Unit tests mocking `HttpService` had to account for this: `upstream.service.spec.ts` uses a `respondWith()` helper that returns a custom Observable simulating per-subscription attempts, rather than chaining `mockReturnValueOnce()` on the mock function (which is only ever called once per outer request).

## Next Immediate Task

Implement **Phase 2 (First Vertical Slice: Posts, read-only)**:

* Build `PostsModule`, `PostsController`, `PostsService` for `GET /posts` and `GET /posts/:id`.
* Add `Post` entity, `QueryPostsDto` (`?userId=`), and a custom `ParsePositiveIntPipe` for the `:id` param.
* Unit tests for controller + service (service calls mocked `UpstreamService` with the right path/params).
* First real E2E test using `nock` to mock the upstream HTTP call — the shape all later resource E2E tests will follow.
