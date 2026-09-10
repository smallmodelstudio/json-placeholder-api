# NestJS Proxy API — Progress Ledger

See `PLAN.md` for the full roadmap and rationale behind the phase ordering.

## Completed Phases

### Phase 1 — Jest → Vitest, and a test structure worth copying

- Removed `jest`/`ts-jest`/`@types/jest`/`ts-node`/`tsconfig-paths`; added
  `vitest`, `@vitest/coverage-v8`, `unplugin-swc`, `@swc/core`.
- `vitest.config.mts` defines three **projects** (replacing the three old Jest
  config files): `unit` (`src/**/*.spec.ts`), `e2e`
  (`test/e2e/**/*.e2e.spec.ts`, nock-mocked), `contract`
  (`test/contract/**/*.contract.spec.ts`, real network, gated by
  `RUN_CONTRACT_TESTS=1`). Run one with `--project <name>`, all with
  `npm run test:all`.
- Moved `test/*.e2e-spec.ts` → `test/e2e/*.e2e.spec.ts`; renamed the contract
  spec to `*.contract.spec.ts`. Colocated unit specs under `src/` untouched.
- `test/support/create-test-app.ts` now takes an optional `configure` callback
  (`TestingModuleBuilder` seam) for tests that need to swap a provider
  entirely; `withEnvOverrides` remains the preferred path for config-value
  overrides, since `ConfigModule.forRoot({ load: [configuration] })` re-reads
  `process.env` fresh on every `compile()`.
- All specs converted from Jest globals to explicit `import { ... } from
  'vitest'` (no `test.globals`) — `jest.fn`→`vi.fn`, `jest.spyOn`→`vi.spyOn`,
  `jest.Mock`→`Mock`, `jest.SpyInstance`→`MockInstance`.
- Fixed two pre-existing type errors a from-scratch `tsc` surfaced
  (`node_modules` had never actually been installed/type-checked before):
  `timeout.interceptor.spec.ts`'s mocked `ConfigService` wasn't parameterized
  to match `ConfigService<AppConfig, true>`; two `.mockImplementation()`
  calls needed an explicit no-op function (Vitest requires one; Jest didn't).
- `test/README.md` documents the pattern for adding each kind of test.
- Verified: `npm run build`, `npm run lint` (0 errors; 95 pre-existing
  `no-unsafe-argument` warnings on `app.getHttpServer()`, unrelated to this
  phase), `npm run test:all` (258 passed, 3 contract tests skipped without
  the env flag — also verified green with `RUN_CONTRACT_TESTS=1` for real).

### Phase 2 — TypeScript 6 as compiler, TypeScript 7 (`tsgo`) as type-checker

- Bumped `typescript` to `^6.0.3` (GA final JS-based release). `nest build`
  needed no `ignoreDeprecations` escape hatch: the only deprecation hit was
  `baseUrl`, which was unused (no non-relative internal imports depend on
  it — `moduleResolution: nodenext` resolves everything else) and was
  removed outright rather than suppressed.
- `experimentalDecorators`/`emitDecoratorMetadata` verified intact — full
  suite (258 tests) still passes, so Nest's DI still resolves.
- `typescript-eslint@8.67.0` (already installed) supports `typescript <6.1.0`
  — no eslint bump needed; lint stays at 0 errors, 95 pre-existing
  `no-unsafe-argument` warnings.
- Added `@typescript/native-preview` (the real npm package for `tsgo`) as a
  dev dependency and a `typecheck` script (`tsgo --noEmit -p tsconfig.json`).
- Tightened `tsconfig.json`: added `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`,
  `noUnusedParameters`, `noPropertyAccessFromIndexSignature`. Fixed the
  fallout:
  - `process.env.X` → `process.env['X']` throughout (`configuration.ts`,
    `upstream-mock.ts`, the contract spec) — `noPropertyAccessFromIndexSignature`.
  - `UpstreamService`'s five HTTP methods and the five list-endpoint
    services (`albums`/`comments`/`photos`/`posts`/`todos`) no longer pass
    `params`/`headers`/`description` as explicit `undefined` — switched to
    conditional object spreads (`...(x !== undefined && { key: x })`) so the
    key is *absent* rather than present-with-undefined, per
    `exactOptionalPropertyTypes`. `UpstreamService.toAxiosOptions()` centralizes
    this for `get`/`post`/`put`/`patch`/`delete`.
  - A handful of `noUncheckedIndexedAccess` gaps in test helpers
    (`upstream.service.spec.ts`'s `respondWith`, the contract spec's
    `posts[0]`, `all-exceptions.filter.spec.ts`'s `jsonMock.mock.calls[0]`)
    got explicit undefined-guards instead of non-null assertions (no `!`
    usage exists elsewhere in the codebase).
  - `TimeoutInterceptor.intercept`'s unused `context` param renamed to
    `_context` (still required by the `NestInterceptor` signature).
- **Investigated, kept as-is**: `skipLibCheck: true`. Flipping it off is
  cheap with `tsgo` (~0.4s) but immediately surfaces type errors inside
  `@nestjs/cache-manager`, `unplugin`, `vite`, and `vitest`'s own `.d.ts`
  files (missing optional-peer type packages like `esbuild`/`bun`/`rollup`,
  and `exactOptionalPropertyTypes` mismatches in their own generic
  defaults) — none fixable from this repo. `nest build` fails the same way,
  confirming it's not just a `tsgo` quirk. Revisit once those upstream
  packages ship cleaner declarations.
- Verified: `npm run build`, `npm run lint` (0 errors, 95 pre-existing
  warnings), `npm run typecheck` (`tsgo`, clean), `npm run test:all` (258
  passed, 3 contract skipped), `npm run test:contract` (3 passed against
  the real upstream).

### Phase 4 — Express → Fastify

Implemented out of phase-number order, at explicit request; `PLAN.md`'s
"Phase ordering and why" and Phase 4 sections were updated to reflect that
Phase 4 no longer depends on Phase 3 (Pagination) — the two are independent,
and only Phase 1's Vitest suite was a real prerequisite.

- `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())`
  in `main.ts`; `app.listen({ port, host: '0.0.0.0' })` (the object form —
  the positional `(port, address)` overload didn't resolve cleanly against
  `ConfigService.get(...)`'s inferred type under `tsgo`; see below).
  `@nestjs/platform-fastify` and `@fastify/static` added;
  `@nestjs/platform-express` and `@types/express` removed.
- **`CorrelationIdMiddleware` → a Fastify `onRequest` hook**
  (`common/hooks/correlation-id.hook.ts`, `registerCorrelationIdHook()`),
  *not* an interceptor as `PLAN.md` originally recommended. Tried the
  interceptor first; it broke the existing "unknown route gets a 404 envelope
  with a correlationId" e2e test, because Nest interceptors (and guards) only
  run once a route has matched — an unmatched path never reaches one. The old
  middleware ran unconditionally via `forRoutes('*')`, and `onRequest` is the
  Fastify-native equivalent: fires before routing, for every request, matched
  or not. Registered on the underlying Fastify instance in both `main.ts` and
  `test/support/create-test-app.ts` (`app.getHttpAdapter().getInstance()`).
- `all-exceptions.filter.ts`: `Request`/`Response` → `FastifyRequest`/
  `FastifyReply`; `.status().json()` → `.status().send()`;
  `request.originalUrl` → `request.url` (Fastify has no `originalUrl`, and
  `request.url` already includes the query string, matching the old
  behaviour and the existing e2e assertion on `path`).
- `http-cache.interceptor.ts`: `request.path` (Express-only) →
  `request.routeOptions.url` — the route *pattern*, not `request.url`, since
  Fastify's `.url` includes the query string and would otherwise change the
  `/health` cache-exclusion key per query string.
- `transform.interceptor.ts` / `logging.interceptor.ts`: type-only swap to
  `FastifyRequest`; `originalUrl` → `url` in the logging interceptor.
- `common/types/express.d.ts` → `common/types/fastify.d.ts`
  (`declare module 'fastify' { interface FastifyRequest { correlationId } }`).
- `test/support/create-test-app.ts`: `createNestApplication<NestFastifyApplication>(new FastifyAdapter())`,
  then `await app.getHttpAdapter().getInstance().ready()` before returning —
  supertest hitting `getHttpServer()` before Fastify's async boot finishes
  saw connection resets otherwise.
- Verified: `npm run build`, `npm run lint` (0 errors, 95 pre-existing
  warnings — same count as Phase 1/2), `npm run typecheck` (clean),
  `npm run test:all` (259 passed, 3 contract skipped), `npm run test:contract`
  (3 passed against the real upstream). Also ran the app directly (`npm run
  start`) and curled it: `GET /posts/1` (200, enveloped, cache hit on second
  call), `GET /nope` (404 envelope with a correlationId — the case the
  interceptor approach missed), a client-supplied `x-correlation-id` echoed
  on both the header and `meta.correlationId`, `GET /health` (200, confirmed
  *not* cached across two calls), `GET /docs` (200, Swagger UI renders with
  no extra `@fastify/static` wiring needed beyond the dependency itself).

### Phase 5 — Docker

Implemented out of phase-number order, at explicit request — Phase 3
(Pagination) is still not started; Docker didn't depend on it (see
`PLAN.md`'s "Phase ordering and why": pagination is independent feature
work, not a platform prerequisite).

- `Dockerfile`: three stages — `deps` (`npm ci`), `build` (`nest build`
  then `npm prune --omit=dev` to strip devDependencies out of
  `node_modules`), `runtime` (nothing copied in but `dist/`, the pruned
  `node_modules/`, and `package.json`). Base image is `node:24-slim`, not
  the Node 22 LTS `PLAN.md` sketched — `.nvmrc` already pins `v24.16.0`,
  and matching the dev environment took precedence over the stale
  recommendation.
- Non-root: runs as the `node` user the base image already provides
  (uid/gid 1000); runtime-stage `COPY --chown=node:node` so it can
  actually read what was copied in as root.
- Signal handling: `dumb-init` (via `apt-get`) as `ENTRYPOINT`, `CMD
  ["node", "dist/src/main.js"]`. Chose baking it into the image over
  Compose's `init: true` — this image is also what Phase 6 deploys into
  Kubernetes, which has no equivalent flag, so the image needs to own its
  own PID 1 regardless of orchestrator.
- `HEALTHCHECK` shells out to `node -e` hitting `/health/live` over
  `node:http` — no `curl`/`wget` needed on `-slim`.
- **Health endpoints split** (`src/health/health.controller.ts`): the old
  bare `GET /health` (ping-the-upstream) is gone, replaced by
  `GET /health/live` (no indicators — Terminus's `check([])`, never fails
  on upstream trouble) and `GET /health/ready` (same upstream ping the old
  route did). `/health/startup` stayed optional/unimplemented — nothing
  in `PLAN.md`'s Phase 6 sketch wires a startup probe. Updated
  `health.controller.spec.ts`, `test/e2e/health.e2e.spec.ts`, and
  `test/e2e/throttle.e2e.spec.ts` (which exercised the old route to prove
  the throttle exemption). `HttpCacheInterceptor`'s `/health` exclusion
  and the Swagger tag needed no code change — the interceptor already
  matched on a `startsWith('/health')` prefix.
- Fixed `package.json`'s `start:prod`, which ran `node dist/main` — the
  actual compiled entrypoint is `dist/src/main.js`
  (`nest-cli.json`'s `sourceRoot: src` nests build output under
  `dist/src/`). Silently broken since before Phase 1; nothing had run it
  until the Dockerfile needed the real path.
- `docker-compose.yml`: single `app` service building the same
  `Dockerfile`, `.env.example` as `env_file` (copy to `.env` and edit for
  local overrides — gitignored), left a comment marking where Phase 8
  adds an `otel` service.
- `.dockerignore`: excludes `node_modules`/`dist`/`coverage` (rebuilt
  fresh in-image), `.git`, `test/`, `*.md`, `.env*` (config is supplied at
  `docker run`/compose time, never baked in).
- Verified directly with `docker build` + `docker run`: image size 451MB
  (Nest + Swagger + Terminus's dependency tree on `-slim`, not bloat —
  `npm prune --omit=dev` confirmed working); `process.getuid()` inside the
  container → 1000, confirming non-root; `docker stop` on a running
  container logged `AppModule`'s `onApplicationShutdown` and exited in
  ~0.25s, confirming `dumb-init` forwards `SIGTERM` to the real process
  rather than the container hanging to the orchestrator's kill timeout;
  `--env-file .env.example` verified end-to-end (`GET /posts/1`,
  `GET /health/live`, `GET /health/ready` all correct). `docker compose
  up` needed a second run on an unmapped port to confirm cleanly: this
  sandbox already has an unrelated host process bound to `0.0.0.0:3000`,
  so `localhost:3000` from the host resolved to that process rather than
  Docker's forwarded port — confirmed not a `docker-compose.yml` defect by
  hitting the same route from inside the container (200) and via a
  container run on a free host port (200). Full suite still green (261
  passed, 3 contract skipped) after the health-endpoint split; `npm run
  lint` (0 errors, 96 pre-existing `no-unsafe-argument` warnings — one
  more than before, from the new e2e assertions) and `npm run typecheck`
  both clean.

## Current Phase

### Phase 3 — Pagination

Not started. See `PLAN.md` for the upstream pagination semantics, the
`getWithMeta()` refactor, and the four call sites (DTOs, interceptor,
nested routes, Swagger) it touches. No longer a prerequisite for Phase 4
or Phase 5 (both complete) — pagination was always independent feature
work, not a platform prerequisite.

## Active Context Architecture

- Vitest globals are deliberately **off** — every spec imports its own
  `describe`/`it`/`vi`/etc.; see `test/README.md` for the pattern per kind.
- `unplugin-swc` reads decorator settings from `tsconfig.json` automatically
  — don't duplicate that config in `vitest.config.mts`.
- `tsconfig.json` has no `baseUrl` and no path aliases — all internal
  imports are relative. `emitDecoratorMetadata`/SWC (Phase 1) is what makes
  DI work, not `tsc`'s module resolution.
- `exactOptionalPropertyTypes` is on: never assign `undefined` explicitly to
  an optional property key. Build the object with a conditional spread
  instead so the key is omitted. See `UpstreamService.toAxiosOptions()` for
  the pattern.
- `tsgo --noEmit` (via `npm run typecheck`) is the fast type-check gate;
  `nest build` (still `tsc` under the hood) remains the emit path until
  TypeScript 7.1 ships a stable programmatic API for `typescript-eslint`
  and friends to build against.
