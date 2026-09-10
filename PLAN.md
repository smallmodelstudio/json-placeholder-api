# Plan — JSONPlaceholder Proxy API

A learning-first roadmap. The API itself is deliberately simple; the point is to use it
as a vehicle for NestJS internals and the surrounding platform ecosystem.

Each phase is independently shippable and ends in a green test suite. Update
`PROGRESS.md` at the end of each phase (see `CLAUDE.md`).

---

## Current state

Nest 11 / Fastify 5 / TypeScript 6 (tsgo type-checked) / Vitest 5. Six resource
modules (posts, users, comments, todos, albums, photos) proxying
`jsonplaceholder.typicode.com` through a
shared `UpstreamService`, with a `{ data, meta }` success envelope, a global error
envelope, correlation IDs, caching, throttling, retries, timeouts, Swagger, and
Terminus health checks. Unit tests colocated in `src/`, e2e + contract tests in `test/`.
Dockerized, deployable to a local k3d cluster via Kustomize, with pipeline-as-code
for Harness CI/CD and OpenTelemetry traces/metrics/logs (structured via `nestjs-pino`,
correlated with `correlationId`) exportable to any OTLP backend — `grafana/otel-lgtm`
locally by default.

---

## Phase ordering and why

The dependency chain is not the order the ideas were raised:

```text
1. Vitest + test structure   ─┐  ts-jest is a hard blocker on TS 7, so the test
                              │  migration must land before the TS upgrade.
2. TypeScript 6 + tsgo       ─┘

3. Pagination                ─── feature work; independent of the platform swap
                                 below, so it can land before or after it.

4. Express → Fastify         ─── the riskiest refactor. Wants a fast, trustworthy
                                 suite (1) first; doesn't otherwise depend on (3) —
                                 done ahead of pagination, validated against the
                                 existing e2e coverage plus a correlation-ID
                                 round-trip test.

5. Docker                    ─┐
6. Kubernetes (local)        ─┤  each builds directly on the previous.
7. Harness CI/CD             ─┤
8. Observability             ─┘  can be pulled forward to run locally at any point.
```

---

## Phase 1 — Jest → Vitest, and a test structure worth copying

**Why first:** `ts-jest` depends on TypeScript's programmatic API, which TypeScript 7
does not stably expose until 7.1. Vitest compiles via SWC and is indifferent to the
TypeScript version, so this phase is what makes Phase 2 possible.

### The one real obstacle

Vitest transpiles with esbuild, and **esbuild does not implement
`emitDecoratorMetadata`**. Nest's entire DI system reads that metadata — without it,
every constructor injection resolves to `undefined`. The fix is to swap the transform
for SWC via `unplugin-swc`:

```ts
// vitest.config.ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })], // inherits tsconfig.json
});
```

This is a genuinely useful thing to understand: it is the same reason `nest build`
offers an SWC path, and the same constraint that will shape Phase 2.

### Target structure

Colocated unit tests stay colocated — they are the Nest convention and keep the unit
under test next to its spec. Everything requiring a booted app moves under `test/`:

```text
src/**/*.spec.ts                  unit — mocked deps, no Nest app, no network
test/
  e2e/*.e2e.spec.ts               booted app + nock'd upstream
  contract/*.contract.spec.ts     real upstream, opt-in via RUN_CONTRACT_TESTS
  support/                        builders, fixtures, custom matchers
vitest.config.ts                  shared defaults
vitest.workspace.ts               three projects: unit | e2e | contract
```

Three Vitest *projects* replace the three Jest config files (`package.json#jest`,
`test/jest-e2e.json`, `test/jest-contract.json`), giving one command that can run all
three, or `--project unit` for the fast inner loop.

### Work

- [ ] Add `vitest`, `unplugin-swc`, `@swc/core`, `@vitest/coverage-v8`; remove `jest`,
      `ts-jest`, `@types/jest`, and the three Jest configs.
- [ ] Write `vitest.config.ts` + `vitest.workspace.ts`.
- [ ] Codemod the specs: `jest.fn` → `vi.fn`, `jest.spyOn` → `vi.spyOn`,
      `jest.useFakeTimers` → `vi.useFakeTimers`. Watch for `vi.mock` hoisting, which
      differs from `jest.mock` — factory closures over outer variables will fail.
- [ ] Port `test/support/nock-setup.ts` to `setupFiles`; nock works unchanged.
- [ ] Rename `*.e2e-spec.ts` → `*.e2e.spec.ts` and move into `test/e2e/`.
- [ ] Rewrite `test/support/create-test-app.ts` as a builder that accepts per-test
      config overrides (it currently hardcodes `AppModule` with no seam for
      `overrideProvider`) — the throttle and cache e2e tests both want this.
- [ ] **Write `test/README.md`**: the pattern for adding a new test — which project it
      belongs in, which helper to use, how to mock the upstream. This is the
      deliverable that makes the structure durable.

### Done when

All three projects pass, coverage reports, and a new resource can be tested by copying
one file and changing a noun.

---

## Phase 2 — TypeScript 6 as compiler, TypeScript 7 as type-checker

Your instinct here is correct, and the reason is sharper than "hybrid is safer".

### The actual constraint

TypeScript 7.0 shipped GA in July 2026 with the Go-native compiler (8–12× faster).
But **7.0 exposes no stable programmatic API** — that lands in 7.1. Every tool that
loads the compiler as a library is therefore stuck on the 6.x line for now, including
`typescript-eslint`, which this repo uses in `eslint.config.mjs`.

TypeScript 6.0 is the final JavaScript-based release: API-compatible with 5.9, but it
turns a batch of deprecations into errors specifically to prepare you for 7.0.

So the setup is:

| Job | Tool | Why |
|---|---|---|
| Emit / build | `nest build` (tsc 6, or SWC) | Decorator metadata, stable toolchain |
| Lint | `typescript-eslint` on TS 6 | Needs the programmatic API |
| Fast type-check | `tsgo --noEmit` (TS 7) | 8–12× faster; pure checking needs no API |
| Test transform | SWC (Phase 1) | Version-independent |

`tsgo` becomes a `typecheck` script and a CI gate. Nothing depends on its API, so it
is safe to adopt now — and when 7.1 lands, you flip the emit path over and delete the
6.x pin.

### Work

- [x] Bump to `typescript@6`. Expect breakage; set `"ignoreDeprecations": "6.0"` as a
      temporary escape hatch, then remove it once the warnings are cleared.
      (No escape hatch needed in practice — the only deprecation hit was
      `baseUrl`, which was unused and got removed instead of suppressed.)
- [x] Confirm `experimentalDecorators` + `emitDecoratorMetadata` survive the bump —
      they are not on the 6.0 deprecation list, but verify rather than assume, since
      the whole app depends on them.
- [x] Add `typescript-go` (`tsgo`) as a dev dependency; add
      `"typecheck": "tsgo --noEmit -p tsconfig.json"`.
      (Package is `@typescript/native-preview` on npm.)
- [x] Tighten `tsconfig.json` while you are in there — `CLAUDE.md` promises "strict
      TypeScript rules" but the config stops at `strict: true`. Missing and worth
      adding: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
      `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`,
      `noPropertyAccessFromIndexSignature`. `noUncheckedIndexedAccess` in particular
      will surface real gaps around `STATUS_CODES[...]` in
      `src/common/filters/all-exceptions.filter.ts`.
      (That specific line was already safe — `?? 'Error'` — but the other five
      flags surfaced real gaps; see `PROGRESS.md`.)
- [x] Reconsider `skipLibCheck: true` once `tsgo` makes full checking cheap.
      (Tried it — cheap to run, but surfaces unfixable errors inside
      `@nestjs/cache-manager`/`unplugin`/`vite`/`vitest`'s own `.d.ts` files.
      Kept `true`; see `PROGRESS.md`.)

### Done when

`npm run build`, `npm run lint`, `npm run typecheck`, and all three test projects pass.

---

## Phase 3 — Pagination

### What the upstream actually supports

Verified against the live API:

| Query | Behaviour |
|---|---|
| `?_page=2&_limit=5` | Page slice, `x-total-count: 100`, plus `Link` header with `first`/`prev`/`next`/`last` |
| `?_start=10&_limit=5` | Offset slice, `x-total-count` present, no `Link` |
| `?userId=1&_start=0&_limit=3` | Filters compose with pagination; `x-total-count: 10` reflects the **filtered** total |
| `?_sort=id&_order=desc` | Sorting, also available |

So real pagination metadata is achievable, not synthesised.

### The blocker

`UpstreamService.request()` ends with `return response.data` — the headers, including
`x-total-count`, are discarded before any caller sees them. **This is the central
refactor of the phase.**

Recommended shape: keep `get<T>()` as-is for single resources, and add a sibling that
preserves the envelope:

```ts
interface UpstreamResponse<T> { data: T; headers: Record<string, string>; }
getWithMeta<T>(path, options): Promise<UpstreamResponse<T>>
```

Rewrite `get()` in terms of it. Existing callers are untouched; list endpoints migrate.

### Then, four more places to touch

1. **`ValidationPipe` runs with `forbidNonWhitelisted: true`** (`src/app.module.ts:67`),
   so an undeclared `?page=` returns 400. Every list DTO must declare the pagination
   params. Introduce `src/common/dto/pagination-query.dto.ts` with validated
   `page`/`limit` (bounded — cap `limit`, default it) and have `QueryPostsDto`,
   `QueryCommentsDto`, `QueryTodosDto`, `QueryAlbumsDto`, `QueryPhotosDto` extend it.
   Note `users` has **no** query DTO at all — add `QueryUsersDto` for consistency.

2. **`TransformInterceptor` hardcodes its meta** (`transform.interceptor.ts:30-36`) to
   `{ timestamp, correlationId }`. Pagination meta has to merge in without every
   controller knowing about the envelope. Cleanest approach: a `Paginated<T>` result
   class returned by paginated services, which the interceptor detects and unwraps —
   spreading its meta alongside the existing fields and hoisting `items` to `data`.
   Controllers stay declarative; the envelope stays in one place.

3. **Nested routes need it too**: `/posts/:id/comments`, `/users/:id/{posts,todos,albums}`,
   `/albums/:id/photos`. `PostsService.findComments` currently delegates to
   `CommentsService.findAll({ postId })` — that delegation should carry pagination
   through rather than being special-cased.

4. **Swagger**: `ApiEnvelopedResponse` in
   `src/common/decorators/api-envelope-response.decorator.ts` describes the current
   two-field meta. It needs a paginated variant, or the generated OpenAPI spec silently
   lies about paginated endpoints.

### Design decisions to make

- **`_page` or `_start`?** `_page` is friendlier and gives you `Link` headers for free;
  `_start` maps to cursor-style thinking. Recommend exposing `?page=&limit=` publicly
  and translating to `_page`/`_limit` internally — the proxy's contract shouldn't leak
  the upstream's underscore convention.
- **Cache interaction**: `HttpCacheInterceptor` keys on the full URL, so distinct pages
  cache separately (correct), but `total` is cached with the page and can go stale
  within the TTL. Acceptable here; worth a comment explaining the tradeoff.

### Work

- [ ] `UpstreamService.getWithMeta()`, `get()` refactored onto it, spec updated.
- [ ] `PaginationQueryDto` + `Paginated<T>` + interceptor unwrapping.
- [ ] All six list endpoints + all nested list routes.
- [ ] Swagger decorator variant; regenerate and check `/docs`.
- [ ] e2e tests: default page, explicit page, `limit` cap enforcement, out-of-range
      page, pagination composed with an existing filter, and meta correctness.

---

## Phase 4 — Express → Fastify

This is the phase you asked about explicitly, so here is the honest assessment: the
adapter swap is one line, and the fallout is roughly a day of careful work. Nest's
platform abstraction is genuinely good, but this codebase reaches through it in six
places.

### What changes at the seam

```ts
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);
```

### The six files that import from `express`

| File | Coupling | Fix |
|---|---|---|
| `common/middleware/correlation-id.middleware.ts` | `req.header()`, `res.setHeader()` | see trap below — replaced by `common/hooks/correlation-id.hook.ts` |
| `common/filters/all-exceptions.filter.ts` | `res.status().json()`, `req.originalUrl` | `.status().send()`; `request.url` (Fastify has no `originalUrl`) |
| `common/interceptors/http-cache.interceptor.ts` | **`request.path`** | Fastify has no `.path`; used `request.routeOptions.url` |
| `common/interceptors/transform.interceptor.ts` | `Request` type only | type swap |
| `common/interceptors/logging.interceptor.ts` | `Request` type only | type swap |
| `common/types/express.d.ts` | `namespace Express` augmentation | rewritten as `common/types/fastify.d.ts`, `declare module 'fastify'` |

### The trap worth understanding

Nest middleware under Fastify runs through **middie**, which hands your `use()` the
**raw Node `IncomingMessage`**, not the `FastifyRequest`. So
`CorrelationIdMiddleware` would set `correlationId` on `request.raw`, while
`TransformInterceptor`, `LoggingInterceptor`, and `AllExceptionsFilter` all read it
off `FastifyRequest` — and get `undefined`. **Every response's `correlationId` would
silently become undefined, and no unit test would catch it**, because the middleware
spec tests the middleware in isolation.

Three ways out, in increasing order of how much they teach you:

1. Read `request.raw.correlationId` in the consumers — works, but leaks the adapter.
2. Replace the middleware with a Fastify `onRequest` hook — fastest, most Fastify-native.
3. Replace it with a Nest **interceptor or guard** — platform-agnostic, keeps the
   abstraction honest, and is the more idiomatic Nest answer. **Recommended.**

Add an e2e assertion that `x-correlation-id` round-trips *before* starting the swap.

**What actually happened:** option 3 has a gap this plan didn't anticipate.
Interceptors (and guards) only run once a route has matched; a request to a
completely unknown path never reaches one, so an interceptor-based
`CorrelationIdInterceptor` left 404s with no `correlationId` —
caught immediately by the existing "404 envelope has a correlationId" e2e test,
since the old middleware ran unconditionally via `forRoutes('*')` and that test
already existed. Went with **option 2** instead:
`registerCorrelationIdHook()` in `common/hooks/correlation-id.hook.ts`, a raw
Fastify `onRequest` hook registered on the underlying instance in both
`main.ts` and `test/support/create-test-app.ts`. It runs before routing, so it
covers matched and unmatched routes alike, same as the middleware it replaces.

### Also on the list

- **`request.path` in the cache interceptor** guards `/health` from being cached.
  `FastifyRequest.url` includes the query string, so a naive swap changes the cache key
  and the `/health` guard. Use `request.routeOptions.url` (the route pattern) or
  `request.raw.url` deliberately, and keep the existing cache e2e test honest.
- **`app.listen()` must bind `0.0.0.0`** under Fastify or the container in Phase 5 will
  accept no traffic. `main.ts:33` currently passes only a port.
- **Supertest** needs `await app.getHttpAdapter().getInstance().ready()` before
  `getHttpServer()` — otherwise the Fastify instance isn't routable yet. This affects
  `test/support/create-test-app.ts` and therefore every e2e test.
- **Throttler** derives the client IP from the request; behind an ingress (Phase 6) you
  need Fastify's `trustProxy` set or every pod-mate shares one bucket.
- **Swagger** works on Fastify, but `SwaggerModule.setup` may pull `@fastify/static`.
- **Validation/DI/Terminus/cache-manager/axios** are all platform-agnostic — no change.

### Is it worth it?

For throughput, marginally — this app's bottleneck is the upstream HTTP call, not the
server. For learning, yes: it forces the platform-abstraction boundary into the open
and shows you exactly where you'd accidentally coupled to Express. That is the real
return here, and it's a good reason to do it.

### Work

- [x] Correlation-ID round-trip e2e coverage (already existed — see
      `test/e2e/errors.e2e.spec.ts`'s "correlation ids" block — so no new test was
      needed before starting the swap). Not gated on Phase 3 (Pagination), which
      this phase no longer depends on.
- [x] `@nestjs/platform-fastify`, `@fastify/static`; removed
      `@nestjs/platform-express`, `@types/express`.
- [x] Rewrote the six files; `express.d.ts` → `fastify.d.ts`.
- [x] Replaced `CorrelationIdMiddleware` with a Fastify `onRequest` hook (not an
      interceptor — see "What actually happened" above).
- [x] Fixed `create-test-app.ts` for `.ready()`.
- [x] `main.ts`: `await app.listen({ port, host: '0.0.0.0' })` (the object form —
      the positional `(port, address)` overload didn't resolve cleanly against
      `ConfigService.get(...)`'s inferred type under `tsgo`).
- [x] Full suite green (259 passed, 3 contract skipped without the env flag,
      verified separately with `RUN_CONTRACT_TESTS=1`); manually verified against
      the running app: `GET /posts/1` (200, enveloped), `GET /nope` (404 with a
      correlationId), correlation-ID echo with a client-supplied header,
      `GET /health` (200, never cached), `GET /docs` (200, Swagger UI renders).

---

## Phase 5 — Docker

### Dockerfile shape

Multi-stage, three stages: `deps` (npm ci) → `build` (`nest build` + prune to prod
deps) → `runtime`. Node 22 LTS on `-slim` or distroless. Non-root `USER node`. Signal
handling via `--init` or `dumb-init`, which matters because `app.enableShutdownHooks()`
is already wired in `app.module.ts` and you want it to actually fire.

**What actually happened:** used `node:24-slim`, not Node 22 LTS — `.nvmrc` already
pins `v24.16.0` (Node 24 became the current LTS line after this plan was written), and
matching the dev environment beat the stale recommendation. Went with `dumb-init`
baked into the runtime image (via `apt-get`) rather than Compose's `init: true`:
`init: true` only helps under Compose/`docker run --init`, and this same image is the
one Phase 6 deploys into Kubernetes, where there's no equivalent flag — the image
needs to carry its own PID 1 regardless of orchestrator.

### The health-check finding

`HealthController` pings the upstream. That is correct for **readiness** and wrong for
**liveness** — if JSONPlaceholder has a bad ten minutes, Kubernetes will restart every
pod in a loop for a fault the pod cannot fix. Split before Phase 6:

- `GET /health/live` — process is up. No dependencies. Never fails on upstream trouble.
- `GET /health/ready` — upstream reachable. Pod is removed from the Service on failure.
- `GET /health/startup` — optional, generous budget for cold start.

**What actually happened:** implemented `/health/live` and `/health/ready` only;
`/health/startup` stayed optional and Phase 6's plan only ever wired liveness and
readiness probes, so there was no consumer for it yet. The old bare `GET /health`
(readiness behaviour) was removed rather than kept as an alias — `PLAN.md` said to
split it, and a lingering third variant would just be one more thing to keep in sync.

### Work

- [x] Multi-stage `Dockerfile` + `.dockerignore`.
- [x] Split the health endpoints; update `health.controller.spec.ts` and
      `test/e2e/health.e2e.spec.ts` (also `test/e2e/throttle.e2e.spec.ts`, which
      exercised the old bare `/health` route to assert the throttle exemption).
- [x] `docker-compose.yml` for the local loop (app + later the observability stack).
- [x] Verify: image size, non-root, `SIGTERM` drains cleanly, env via `--env-file`.
      (451MB — a Nest + Swagger + Terminus dependency tree on `-slim`, not a bloated
      build; `npm prune --omit=dev` in the build stage keeps devDependencies out.
      `USER node` confirmed via `process.getuid()` → 1000. `docker stop` on a running
      container logged `AppModule`'s `onApplicationShutdown` and exited in ~0.25s,
      confirming `dumb-init` forwards `SIGTERM` to the real PID rather than the
      container hanging until the orchestrator's kill timeout. `--env-file
      .env.example` verified against a real `docker run`.) Also fixed
      `package.json`'s `start:prod` script, which pointed at `dist/main` — the
      actual compiled entrypoint is `dist/src/main.js` (`nest-cli.json`'s
      `sourceRoot: src` nests build output under `dist/src/`); this had been
      silently broken since before Phase 1 since nothing ran it. `docker-compose up`
      itself needed a second, unmapped-port run to verify cleanly: this sandbox
      already has an unrelated host process bound to `0.0.0.0:3000`, so `localhost:3000`
      from the host resolved to that process instead of Docker's forwarded port —
      not a defect in `docker-compose.yml`, confirmed by hitting the same route from
      inside the container (200) and via a container run on a free host port (200).

---

## Phase 6 — Kubernetes, locally

**k3d** (k3s in Docker) is the right local choice on WSL2 — lighter than kind or
minikube, ships Traefik, and its registry integration avoids the "push to where?"
problem.

### Manifests

Kustomize with `base/` + `overlays/{local,prod}`. Recommended over Helm to start: you
read plain YAML rather than templating language, which is better for learning the API
objects themselves. Helm becomes the interesting exercise later, once you know what
it's generating.

```text
k8s/
  base/            deployment, service, ingress, configmap, hpa, pdb, kustomization
  overlays/local/  1 replica, debug logging, NodePort/Traefik
  overlays/prod/   3 replicas, real limits, ingress host
```

### Points worth dwelling on

- `livenessProbe` → `/health/live`; `readinessProbe` → `/health/ready` (Phase 5).
- `resources.requests` / `limits`, and how the JVM-style memory story differs for Node.
- `terminationGracePeriodSeconds` vs. Nest's shutdown hooks and in-flight requests.
- ConfigMap for `.env.example` values; Secret for anything sensitive later.
- HPA on CPU — then observe that a proxy bound on upstream latency doesn't scale on CPU,
  which is a good segue into Phase 8's custom metrics.

### Work

- [x] `k3d cluster create` script + local registry.
      (`k8s/k3d/create-cluster.sh` / `delete-cluster.sh`. `k3d` itself
      wasn't installed and `/usr/local/bin` needs `sudo`, which this
      environment can't satisfy non-interactively — installed to
      `~/.local/bin` instead via the official script's
      `K3D_INSTALL_DIR`/`USE_SUDO=false` knobs.)
- [x] Base manifests + two overlays.
      (`k8s/base/{deployment,service,ingress,configmap,hpa,pdb,kustomization}.yaml`,
      `k8s/overlays/{local,prod}/kustomization.yaml`. Only `local` has been
      applied to a real cluster; `prod` renders cleanly via
      `kubectl kustomize` but points at placeholder registry/host values —
      there's no prod cluster in this project yet.)
- [x] Ingress via Traefik; hit the API and `/docs` through it.
      (k3d ships Traefik by default. Verified via
      `curl -H 'Host: api.localhost' http://localhost:8080/posts/1` → 200
      enveloped response, `/health/live` → 200, `/health/ready` → 200,
      `/docs` → 200.)
- [x] Document the loop in `README.md`: build → import → apply → curl.
      (New "Kubernetes (local, via k3d)" subsection under "Deployment",
      alongside a "Docker" subsection that Phase 5 had left undocumented.)

---

## Phase 7 — Harness CI/CD

### Correcting the premise, because it changes the plan

**Harness does not host Kubernetes clusters for your workloads.** It is a control
plane: it orchestrates deployments *into a cluster you provide*, via a **Delegate** —
a lightweight worker you install in your cluster that talks **outbound-only** over
HTTPS. So "deploy for free to Harness on Kubernetes" resolves to *Harness as the
free CI/CD brain, plus a cluster you get for free somewhere else*.

The good news: because the Delegate is outbound-only, **your local k3d cluster from
Phase 6 is a completely valid deployment target** — no port-forwarding, no public IP,
no tunnel. Harness will happily deploy into WSL2.

### Free tier, as it stands

- Up to **5 developers**.
- **2,000 Harness Cloud credits/month** for hosted builds (credit-card validation
  required to enable Harness Cloud).
- **Unlimited self-hosted runner execution** — so a local runner sidesteps the credit
  budget entirely once you outgrow it.

That is comfortably enough for this project.

### Cluster options

| Target | Cost | Public URL | Notes |
|---|---|---|---|
| Local k3d + Delegate | Free | No | **Recommended start.** Real pipeline, zero spend, no cloud account. |
| Oracle Cloud Always Free (4× ARM Ampere) + k3s | Free indefinitely | Yes | Best if you want a real URL. ARM means a multi-arch image build. |
| GKE/EKS/AKS free credits | Time-limited | Yes | Fine for a demo, will eventually bill. |

Recommended path: prove the pipeline against local k3d first, then repoint the
Delegate at a free cloud cluster if you want a public endpoint. The pipeline barely
changes — that portability is the lesson.

### Pipeline

```text
CI:  clone → npm ci → lint + typecheck + unit → e2e → build image → push
CD:  fetch manifests → deploy (rolling) → verify → [approval] → prod stage
```

Store it as `.harness/*.yaml` in-repo (pipeline-as-code) rather than clicking through
the UI — it's reviewable, and it's how you'd actually run it.

### Work

- [x] CI pipeline with the Phase 1/2 scripts as explicit parallel steps.
      (`.harness/pipelines/ci.yaml`: `npm ci`, then lint/typecheck/unit in
      parallel, then e2e, then build+push the image, then a `Run` step that
      promotes the built tag into `k8s/overlays/local` via `kustomize edit
      set image` and a git commit/push — see "Why CI promotes the image tag
      via a git commit" in `.harness/README.md`.)
- [x] CD pipeline consuming the Phase 6 Kustomize overlays.
      (`.harness/pipelines/cd.yaml`: `K8sRollingDeploy` against
      `local_k3d_infra` → smoke test → `HarnessApproval` → `K8sRollingDeploy`
      against `prod_infra`, each backed by `.harness/services/` +
      `.harness/environments/` + `.harness/infrastructures/` entities whose
      `overlay` variable selects `k8s/overlays/{local,prod}`.)
- [x] Add a **deployment verification** step.
      (A `ShellScript` smoke-test step after each rollout, curling
      `/health/ready` and `/posts/1` against the in-cluster Service — not
      Harness's metrics-based Continuous Verification, which needs real
      data from Phase 8 first; see the step's comment in `cd.yaml`.)
- [x] Optional: contract tests (`RUN_CONTRACT_TESTS=1`) as a scheduled pipeline rather
      than a PR gate, so upstream flakiness never blocks a merge.
      (`.harness/pipelines/contract-tests.yaml` + a daily cron
      `.harness/triggers/contract-tests-cron.yaml`.)
- [ ] Harness account; install Delegate into the k3d cluster; verify it connects.
- [ ] Connectors: GitHub, Docker registry, Kubernetes.

**What actually happened:** this phase was implemented as pipeline-as-code
only, at explicit request, because the remaining two items require a real
Harness account, a Delegate token generated per-account through the Harness
UI, and connector credentials — none of which this environment has or can
generate non-interactively. `.harness/*.yaml` is written to the real Harness
NextGen schema and documents every placeholder that needs a real value once
the account exists (`.harness/README.md`'s setup checklist), the same
"unverified, written to the same shape" treatment `k8s/overlays/prod` got in
Phase 6. One correctness fix along the way: the CD smoke-test step runs *on
the Delegate*, which is itself a pod inside the k3d cluster, so it curls the
in-cluster Service (`json-placeholder-api.default.svc.cluster.local`)
rather than the host-mapped Traefik port (`localhost:8080`) that Phase 6's
README uses from the WSL2 host — those are different network namespaces.

---

## Phase 8 — Observability

### Correcting the premise again

**Dynatrace has no permanent free tier** — a 15-day trial and a public Playground.
Pointing this project's long-term observability at Dynatrace means either paying or
losing your data when the trial ends.

The fix costs nothing and is better engineering anyway: **instrument with
OpenTelemetry, not with a vendor SDK.** The app emits OTLP; the backend is a URL. Run
against a free local backend day to day, flip the endpoint to Dynatrace for the trial
window, and evaluate it properly with real data and zero rework. Vendor-neutral
instrumentation is the correct default regardless of the eventual choice.

### Instrumentation

- `@opentelemetry/sdk-node`, `auto-instrumentations-node`,
  `instrumentation-nestjs-core`, `instrumentation-http`.
- **The SDK must start before Nest bootstraps.** A separate `src/instrumentation.ts`
  loaded via `node --import ./dist/instrumentation.js`, not an import inside `main.ts`
  — otherwise Axios and HTTP are already required and the patches miss.
- **Traces**: an incoming request → the upstream Axios call becomes a two-span trace
  showing exactly how much of your latency is JSONPlaceholder's. Directly explains the
  retry/timeout/cache behaviour in `UpstreamService`.
- **Metrics**: request rate/latency/errors, plus custom ones — cache hit ratio,
  upstream retry count, throttler rejections. All three are already implemented and
  currently invisible.
- **Logs**: replace the default Nest logger with `nestjs-pino` for structured JSON,
  and inject `trace_id`/`span_id`. **Then unify `correlationId` with the OTel trace
  ID** so a log line, a trace, and the response envelope all carry the same
  identifier — the payoff for Phase 4's `correlationId` rework.

### Backend

| Option | Cost | Use |
|---|---|---|
| `grafana/otel-lgtm` (one container) | Free | **Recommended default.** Traces + metrics + logs locally. |
| Dynatrace trial / Playground | Free for 15 days | Point the OTLP endpoint at it; evaluate on real data. |
| Grafana Cloud free tier | Free, persistent | If you want hosted, alongside the k8s work. |

**What actually happened:** the sketch above held up well, with two real gaps this
plan didn't anticipate:

- **`getNodeAutoInstrumentations()` already bundles `instrumentation-http` and
  `instrumentation-nestjs-core`** (and `instrumentation-pino`) — registering them
  separately alongside it would just double-instrument. `instrumentation.ts` calls
  `getNodeAutoInstrumentations()` once, with filesystem instrumentation disabled
  (noisy, irrelevant to a proxy) and pino log-*sending* disabled (log *correlation* —
  `trace_id`/`span_id` injected into every pino line whenever a span is active — stays
  on; it's automatic, no manual `mixin` needed, and is what makes "unify
  `correlationId` with the trace id" actually land: the response envelope, the access
  log, and the trace all end up carrying the identical value with zero extra plumbing
  beyond `correlation-id.hook.ts` preferring `trace.getActiveSpan()?.spanContext().traceId`
  over `randomUUID()` when a span exists).
- **`pino-pretty` is a devDependency, pruned from the production image** by
  `npm prune --omit=dev` (Dockerfile) — gating the pretty-transport choice on
  `NODE_ENV` (as an early draft did) is a trap, because `overlays/local`'s ConfigMap
  sets `NODE_ENV=development` on that same pruned production image just to bump the
  log level, and pino's transport loader throws *synchronously* if the target module
  can't be resolved, crash-looping the pod. Fixed by gating on whether `pino-pretty`
  actually resolves (`require.resolve` in a try/catch) instead of on `NODE_ENV` —
  found by deploying to the real k3d cluster and watching it `CrashLoopBackOff`, not
  by any test, since every test runs from source with all devDependencies present.

Verified for real, not just read from docs: `docker compose up --build` produces a
trace in Tempo, custom metrics in Prometheus, and `trace_id`/`span_id`-correlated JSON
log lines, all inspected directly via `docker compose exec otel curl
localhost:3200/api/search` and `localhost:9090/api/v1/query`. The same held after
pushing the image to the Phase 6 k3d cluster and applying `overlays/local` (which now
also deploys `otel-lgtm` — see the Work item below) — traces, the custom metrics, and a
trace-id `correlationId` all confirmed through Traefik and via `kubectl exec` into the
`otel-lgtm` pod. One unrelated sandbox artifact surfaced along the way: a leftover
`node dist/src/main` process from an earlier session had port 3000 on the *host*
already bound, ahead of Docker's own port-forward for it — the same class of quirk
Phase 5's PROGRESS.md already flagged, worked around the same way there (verify via
`docker compose exec`/from inside the container rather than fighting the host's
`localhost:3000`), not a defect in anything built this phase.

### Work

- [x] `instrumentation.ts` + `--import` wiring in Dockerfile and npm scripts.
- [x] `otel-lgtm` in `docker-compose.yml`; confirm a full trace end to end.
- [x] `nestjs-pino` + trace correlation; unify with `correlationId`.
- [x] Custom metrics for cache / retry / throttle.
- [x] Deploy the collector into k3d; scrape from the Phase 6 cluster.
- [ ] Dynatrace trial: switch `OTEL_EXPORTER_OTLP_ENDPOINT`, spend the 15 days
      evaluating rather than instrumenting.
      (Not done — needs a real Dynatrace account this environment can't
      sign up for, same category of gap as Phase 7's Harness account. The
      instrumentation is vendor-neutral OTLP specifically so this is a
      config change whenever a trial exists, not a rework.)
- [ ] Feed metrics back into Harness deployment verification (Phase 7).
      (Not done — Phase 7's own CD smoke-test step is a plain curl, not
      Harness's metrics-based Continuous Verification, because that needs a
      real Harness tenant to configure against; still blocked on the same
      "no real account" gap Phase 7 documented, now with real metrics on
      the other side of it once that tenant exists.)

---

## Decisions to lock in

These branch the work; everything else is settled above.

1. **Pagination query style** — public `?page=&limit=` (recommended) vs. passing
   `_page`/`_limit` through unchanged.
2. **Manifests** — Kustomize (recommended for learning) vs. Helm.
3. **Deploy target** — local k3d only (recommended start) vs. Oracle Always Free for a
   public URL, which adds multi-arch image builds.
4. **Observability backend** — local `otel-lgtm` as the default with Dynatrace as a
   time-boxed trial (recommended), vs. building around the Dynatrace trial directly.

---

## Sources

- [TypeScript 7.0 released (InfoQ, Aug 2026)](https://www.infoq.com/news/2026/08/typescript-7-released/)
- [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [microsoft/typescript-go](https://github.com/microsoft/typescript-go)
- [NestJS + Vitest migration and plugins](https://zenn.dev/maronn/articles/nestjs-vitest-migrate?locale=en)
- [Harness Cloud build infrastructure](https://developer.harness.io/docs/continuous-integration/use-ci/set-up-build-infrastructure/use-harness-cloud-build-infrastructure/)
- [Harness Kubernetes deployments](https://developer.harness.io/docs/continuous-delivery/deploy-srv-diff-platforms/kubernetes/kubernetes-cd-quickstart/)
- [Dynatrace pricing review, 2026](https://cubeapm.com/blog/dynatrace-pricing-and-review/)
