# JSONPlaceholder Proxy API — Implementation Plan

## 1. Folder Structure

```
src/
├── main.ts                          # bootstrap: global pipes/filters, Swagger, shutdown hooks
├── app.module.ts                    # root: imports Config, upstream client, feature modules
│
├── config/
│   ├── configuration.ts             # typed factory -> { http: { baseUrl, timeout, retries }, app: {...} }
│   ├── env.validation.ts            # class-validator schema for process.env
│   └── config.types.ts              # interfaces consumed by ConfigService<AppConfig, true>
│
├── common/
│   ├── filters/
│   │   ├── all-exceptions.filter.ts     # catch-all -> consistent error envelope
│   │   └── upstream-exception.filter.ts # optional: maps UpstreamException specifically
│   ├── interceptors/
│   │   ├── logging.interceptor.ts       # method, path, duration, correlation id
│   │   ├── transform.interceptor.ts     # wraps payload: { data, meta }
│   │   └── timeout.interceptor.ts       # rxjs timeout() -> 504
│   ├── pipes/
│   │   └── parse-positive-int.pipe.ts   # custom pipe (learning goal) for :id
│   ├── decorators/
│   │   └── api-paginated-response.decorator.ts  # composed Swagger decorator
│   ├── dto/
│   │   ├── pagination-query.dto.ts      # _page/_limit passthrough
│   │   └── id-param.dto.ts
│   ├── exceptions/
│   │   └── upstream.exception.ts        # domain error, not HTTP-coupled
│   └── middleware/
│       └── correlation-id.middleware.ts
│
├── upstream/                        # THE shared proxy layer — the core of this project
│   ├── upstream.module.ts           # registerAsync HttpModule w/ ConfigService
│   ├── upstream.service.ts          # get/post/put/patch/delete<T>, retry, error mapping
│   ├── upstream.service.spec.ts
│   └── interfaces/upstream-request.interface.ts
│
└── modules/
    ├── posts/
    │   ├── posts.module.ts
    │   ├── posts.controller.ts
    │   ├── posts.service.ts
    │   ├── dto/
    │   │   ├── create-post.dto.ts
    │   │   ├── update-post.dto.ts       # PartialType(CreatePostDto)
    │   │   └── query-posts.dto.ts       # ?userId=
    │   ├── entities/post.entity.ts      # response shape + Swagger decorators
    │   ├── posts.controller.spec.ts
    │   └── posts.service.spec.ts
    ├── users/      # + nested: /users/:id/posts, /users/:id/todos, /users/:id/albums
    ├── comments/   # + /posts/:id/comments
    ├── todos/
    ├── albums/     # + /albums/:id/photos
    └── photos/

test/
├── jest-e2e.json
├── support/
│   ├── upstream-mock.ts             # nock helpers
│   └── create-test-app.ts           # shared bootstrap w/ same global providers as main.ts
├── posts.e2e-spec.ts
├── users.e2e-spec.ts
└── contract/
    └── jsonplaceholder.contract-spec.ts  # opt-in, hits the real API
```

**The key structural idea:** `upstream/` is a single shared module owning all outbound HTTP concerns. Feature services never touch `HttpService` directly — they call `UpstreamService.get<Post[]>('/posts', { params })`. That gives you one place for retries, timeouts, error translation, and one mock seam for every unit test.

---

## 2. Key NestJS Features to Incorporate

|Feature|Where it earns its place here|
|---|---|
|**ConfigModule**|`isGlobal: true`, `load: [configuration]`, `validate:` with class-validator. Use `ConfigService<AppConfig, true>` for inferred types — no `configService.get('foo.bar')` stringly-typed lookups.|
|**HttpModule (`@nestjs/axios`)**|`registerAsync` inside `UpstreamModule` so baseURL/timeout come from config. Exercises async module factories + DI.|
|**DTOs + class-validator/class-transformer**|Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } })`. Body DTOs for POST/PUT/PATCH, query DTOs for `?userId=&_page=&_limit=`.|
|**Mapped types**|`PartialType`, `OmitType`, `PickType` from `@nestjs/swagger` — `UpdatePostDto extends PartialType(CreatePostDto)`.|
|**Custom pipe**|`ParsePositiveIntPipe` — worth writing by hand once even though `ParseIntPipe` exists, then compare.|
|**Exception filters**|Catch-all filter producing a stable envelope `{ statusCode, message, error, path, timestamp, correlationId }`. Translate `UpstreamException` → 502/504 rather than leaking axios errors as 500s.|
|**Interceptors**|Logging (duration), Transform (response envelope), Timeout (rxjs `timeout` → `RequestTimeoutException`). Good rxjs practice.|
|**Middleware**|Correlation-ID assignment — shows the middleware vs interceptor distinction (raw req/res vs execution context).|
|**CacheModule**|Genuinely justified for a proxy: `@nestjs/cache-manager` with a per-route TTL. Upstream data is static, so caching is realistic, not contrived.|
|**Throttler**|`@nestjs/throttler` global guard — protects you from hammering the upstream. Also your first **Guard**.|
|**Swagger**|`@nestjs/swagger` + CLI plugin in `nest-cli.json` so DTO metadata is auto-inferred. Docs at `/docs`.|
|**Health checks**|`@nestjs/terminus` with `HttpHealthIndicator` pinging JSONPlaceholder — a natural fit for a proxy.|
|**Lifecycle / RxJS**|`firstValueFrom`, `retry({ count, delay })`, `catchError`, `map` in `UpstreamService`.|

**Two things I'd change in the existing scaffold first:** turn on `"strict": true` in [tsconfig.json](vscode-webview://1g76adg24119g884ev6jhdasg5mdpt8fa4mi7gjttek2qt5vav75/tsconfig.json) (currently `noImplicitAny: false`, `strictBindCallApply: false`) and add path aliases (`@common/*`, `@config/*`, `@upstream/*`) with matching `moduleNameMapper` in the Jest config. Both are much cheaper to do now than after six modules exist.

---

## 3. Testing Strategy

The defining constraint for a proxy: **no test should ever hit the real network**, except one clearly-marked opt-in suite.

**Unit tests — services** (`Test.createTestingModule` + mocked `UpstreamService`)

- Provide `{ provide: UpstreamService, useValue: { get: jest.fn(), post: jest.fn() } }`.
- Assert on the _call contract_: did `PostsService.findAll({ userId: 1 })` invoke `upstream.get('/posts', { params: { userId: 1 } })`? That's the actual logic worth testing in a proxy — the mapping from your API surface to theirs.
- Assert on error translation: upstream 404 → `NotFoundException`.

**Unit tests — `UpstreamService`** (the one place you mock axios itself)

- Mock `HttpService` with `of(...)` / `throwError(...)` observables.
- Cover: success passthrough, retry-on-5xx-then-succeed, no-retry-on-4xx, timeout, network error → `UpstreamException`, upstream status code preservation.

**Unit tests — controllers**

- Mock the service. Verify routing, param/pipe wiring, and status codes. Keep these thin.

**Unit tests — filters/interceptors/pipes**

- Build a fake `ExecutionContext`/`ArgumentsHost` and call `catch()`/`intercept()` directly. Fast and high-value; these are the pieces most likely to break silently.

**E2E tests** (`supertest` + **`nock`** intercepting outbound HTTP)

- A shared `createTestApp()` helper that applies the _same_ global pipes/filters/interceptors as [main.ts](vscode-webview://1g76adg24119g884ev6jhdasg5mdpt8fa4mi7gjttek2qt5vav75/src/main.ts) — otherwise E2E tests pass while production behaves differently. This is the single most common Nest testing mistake.
- Test the full round trip: real routing → real validation → nocked upstream → real filter → asserted JSON envelope.
- Cover the sad paths that only E2E can prove: validation rejection (400 with field errors), upstream 500 → your 502, upstream timeout → 504, unknown route → 404 envelope.
- `nock.disableNetConnect()` in global setup so an un-mocked call fails loudly instead of silently reaching the internet.

**Contract tests** (opt-in, `RUN_CONTRACT_TESTS=1`)

- A handful of tests that _do_ hit `jsonplaceholder.typicode.com` and validate the response shape against your entities. Excluded from CI by default; run manually to detect upstream drift. This is what keeps your nock fixtures honest.

**Coverage target:** don't chase 100%. Aim high on `upstream/` and `common/` (the real logic) and treat thin controller/service passthroughs as low-value coverage.

---

## 4. Phased Roadmap

**Phase 0 — Foundation** _(no features yet)_ Enable `strict`, add path aliases + Jest `moduleNameMapper`, install `@nestjs/config @nestjs/axios axios class-validator class-transformer`, add `.env` / `.env.example`, build `ConfigModule` with env validation, delete the scaffold `app.controller/service`. **Deliverable:** app boots, config is typed and validated, boot fails loudly on a bad env.

**Phase 1 — The upstream client** `UpstreamModule` + `UpstreamService` with typed verbs, `firstValueFrom`, retry/backoff, timeout, and axios-error → `UpstreamException` mapping. Fully unit-tested. **Deliverable:** the proxy engine, tested in isolation, with zero controllers.

**Phase 2 — First vertical slice: Posts (read)** `GET /posts`, `GET /posts/:id`, with entity, query DTO, custom `ParsePositiveIntPipe`. Unit tests for controller + service; first E2E with nock. **Deliverable:** one end-to-end resource proving the architecture — review this shape before replicating it.

**Phase 3 — Cross-cutting concerns** Global `ValidationPipe`, `AllExceptionsFilter`, logging/transform/timeout interceptors, correlation-ID middleware, and the shared `createTestApp()` helper. Unit tests per component + E2E error-path tests. **Deliverable:** consistent error and response envelopes across the whole app.

**Phase 4 — Writes on Posts** `POST`/`PUT`/`PATCH`/`DELETE` with `CreatePostDto`, `UpdatePostDto` via `PartialType`. Note in the README that JSONPlaceholder fakes persistence. **Deliverable:** full CRUD surface, validation proven by E2E 400s.

**Phase 5 — Remaining resources + nested routes** Users, Comments, Todos, Albums, Photos — each following the Phase 2/4 template. Add nested routes (`/posts/:id/comments`, `/users/:id/todos`, `/albums/:id/photos`). **Deliverable:** complete API surface. Mostly repetition — good place to notice what should be abstracted into a base service, and to resist over-abstracting.

**Phase 6 — Production hardening** `CacheModule` with per-route TTL + cache-hit tests, `ThrottlerModule` global guard, Terminus health check at `/health`, graceful shutdown hooks. **Deliverable:** an API that behaves well under load and doesn't abuse the upstream.

**Phase 7 — Documentation & polish** Swagger with the CLI plugin, `@ApiTags`/`@ApiResponse`, a composed custom decorator, README with architecture notes, contract test suite, and coverage review. **Deliverable:** self-documenting API at `/docs`.

---

**Two judgment calls I'd flag for your input:**

1. **`@nestjs/axios` vs native `fetch`.** I've planned for `@nestjs/axios` — it's the idiomatic Nest choice, gives you rxjs operator practice, and mocks cleanly. Native `fetch` is lighter but you'd hand-roll retries/timeouts and lose the DI seam. I'd stay with axios for a learning project.
2. **Phase 5 is repetitive by design.** Six near-identical modules is a lot of typing. The alternative — a generic `ResourceService<T>` base class up front — is arguably better code but teaches you less, and premature generics in Nest tend to fight the DI system. My recommendation: write Posts and Users longhand, then decide whether to abstract before doing the other four.

Let me know what you'd like changed and I'll start on Phase 0.
