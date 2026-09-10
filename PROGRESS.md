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

### Phase 6 — Kubernetes, locally

Implemented out of phase-number order, at explicit request — Phase 3
(Pagination) is still not started; it was never a prerequisite for this
phase either (see `PLAN.md`'s "Phase ordering and why": Phase 6 only
depends on Phase 5's Docker image).

- `k3d` wasn't installed, and the official install script defaults to
  `/usr/local/bin` via `sudo` — this environment has no passwordless
  `sudo` and no terminal for an interactive password prompt. Installed to
  `~/.local/bin` instead (`K3D_INSTALL_DIR=/home/fred/.local/bin
  USE_SUDO=false`), which was already on `PATH` and needed no privilege
  escalation.
- `k8s/base/`: `deployment.yaml` (2 replicas, `envFrom` a ConfigMap,
  liveness → `/health/live`, readiness → `/health/ready`,
  `terminationGracePeriodSeconds: 30`), `service.yaml` (ClusterIP :80 →
  `http`), `ingress.yaml` (Traefik `ingressClassName`, placeholder host —
  every overlay patches it), `configmap.yaml` (mirrors `.env.example`),
  `hpa.yaml` (`autoscaling/v2`, CPU-based, 2–5 replicas), `pdb.yaml`
  (`minAvailable: 1`), `kustomization.yaml` tying them together.
- `k8s/overlays/local/`: 1 replica, `NODE_ENV=development` (the only
  "debug logging" lever the app actually exposes — there's no `LOG_LEVEL`
  in `src/config`), smaller resource requests/limits, HPA range trimmed to
  1–3 so `minReplicas` doesn't exceed the overlay's own replica count,
  `host: api.localhost`, and an `images:` transformer pointing at the
  local registry.
- `k8s/overlays/prod/`: 3 replicas, production-sized resources, same
  shape as `local` — but genuinely untested, since there's no real cluster
  to apply it to. Registry/tag/host are literal `REPLACE_WITH_REAL_*`
  placeholders rather than guessed values.
- `k8s/k3d/create-cluster.sh` / `delete-cluster.sh`: creates a
  `k3d-jsonplaceholder-registry` registry plus a `jsonplaceholder` cluster
  wired to use it, with the loadbalancer's 80/443 mapped to host 8080/8443
  (not 80/443 — nothing else on this host was using them, but the higher
  ports avoid needing any privilege check at all and are the more common
  k3d convention).
- **Registry hostname trap**: the host reaches the registry at
  `localhost:5000` (k3d publishes that port), but the *node's* containerd
  only gets a mirror entry for `k3d-jsonplaceholder-registry:5000` (from
  `--registry-use`) — confirmed by reading
  `/etc/rancher/k3s/registries.yaml` inside the server container. A first
  attempt with `overlays/local` pointing at `localhost:5000/...` produced
  `ImagePullBackOff` (`dial tcp [::1]:5000: connect: connection refused`
  from inside the node). Fixed by making the overlay's `images:`
  transformer rewrite to `k3d-jsonplaceholder-registry:5000/...` instead —
  same registry, two different hostnames depending which network
  namespace you're asking from. Documented in `README.md` since it's the
  kind of thing that looks like a k3d bug the first time you hit it.
- Verified end-to-end against the real cluster: `kubectl apply -k
  k8s/overlays/local` → all six resources created; `kubectl rollout
  status` → succeeded after the registry-hostname fix; pod `1/1 Running`;
  `kubectl get hpa` showed real CPU metrics (`4%/70%`) — k3s ships
  `metrics-server` out of the box, no extra install needed. Through
  Traefik: `curl -H 'Host: api.localhost' http://localhost:8080/posts/1`
  → 200, enveloped `{ data, meta }`; `/health/live` → 200; `/health/ready`
  → 200; `/docs` → 200, Swagger UI. `kubectl kustomize` on both overlays
  confirmed to render without error (only `local` applied to the cluster).
- Not done: no CI for any of this yet (Phase 7), and `prod` overlay
  remains unvalidated against a real cluster by design — see above.

### Phase 7 — Harness CI/CD

Implemented out of phase-number order (Phase 3, Pagination, is still not
started — same rationale as Phases 4-6: it was never a prerequisite), and
scoped to **pipeline-as-code only**, at explicit request: the remaining
work needs a real Harness account, a per-account Delegate token generated
through the Harness UI, and connector credentials, none of which this
environment can create non-interactively.

- `.harness/pipelines/ci.yaml`: `npm ci` → lint/typecheck/unit in parallel
  → e2e → `BuildAndPushDockerRegistry` → a `Run` step that promotes the
  built tag into `k8s/overlays/local` (`kustomize edit set image` +
  git commit/push). The last two steps are gated to `master` only.
- `.harness/pipelines/cd.yaml`: `K8sRollingDeploy` against `local_k3d_infra`
  → `ShellScript` smoke test (curls `/health/ready` and `/posts/1`) →
  `HarnessApproval` → `K8sRollingDeploy` against `prod_infra` → smoke test.
  Each `K8sRollingDeploy` has a matching `K8sRollingRollback` in
  `rollbackSteps`.
- `.harness/pipelines/contract-tests.yaml` + `.harness/triggers/contract-tests-cron.yaml`:
  `npm run test:contract` on a daily cron rather than a PR gate, per
  `PLAN.md`'s "optional" item — upstream flakiness never blocks a merge.
- `.harness/services/json-placeholder-api.yaml`, `.harness/environments/{local-k3d,prod}.yaml`,
  `.harness/infrastructures/{local-k3d,prod}-infra.yaml`: a Kubernetes
  service definition with one Kustomize manifest source, and two
  environments whose `overlay` variable selects `k8s/overlays/local` vs.
  `k8s/overlays/prod` — the same base/overlay split Phase 6 already built.
- **Chose git-commit promotion over Harness's native Kustomize
  artifact-substitution path** (a "Kustomize Patches" manifest type layered
  on top of the base manifest) for getting the CI-built image tag into the
  deployed manifest. The native path is the more "Harness-idiomatic" answer
  but is the piece of this setup furthest from anything verifiable without
  a real tenant; git-commit promotion is a plain, testable-in-principle
  GitOps pattern (CI writes the tag, CD applies whatever's committed) with
  no coupling between the two pipelines beyond git. Documented as a
  deliberate choice, not an oversight, in `.harness/README.md`.
- **Correctness fix while drafting the smoke-test step**: it runs `onDelegate: true`,
  and the Delegate is itself installed as a pod inside the k3d cluster (that's
  the entire point of Harness's outbound-only model) — so it shares the
  cluster's network namespace, not the WSL2 host's. A first draft curled
  `http://localhost:8080` (Phase 6's host-mapped Traefik port); fixed to
  curl the in-cluster Service directly
  (`json-placeholder-api.default.svc.cluster.local`), which needs no
  Ingress/host-header dance at all from inside the cluster.
- **Deployment verification step is a plain smoke test, not Harness's
  metrics-based Continuous Verification** — `PLAN.md` explicitly wants that
  paired with Phase 8, and there's no real metrics backend yet for it to
  gate on. The `ShellScript` step is the honest interim version: the same
  two curls Phase 6 verified by hand, now automated and blocking rollout.
- Every external identifier (connector refs, registry, user group, prod
  host) is a `REPLACE_WITH_REAL_*` placeholder, matching the convention
  `k8s/overlays/prod` already established in Phase 6. `.harness/README.md`
  is the setup checklist: Harness account → install the Delegate into k3d
  (the one genuinely interactive step — the token is generated per-account
  in the UI) → four connectors → find-and-replace the placeholders → import
  entities in dependency order (services → environments →
  infrastructures → pipelines → triggers) → run CI by hand once before
  trusting CD against the cluster.
- Not verified end-to-end against a real Harness tenant (no account exists
  in this project) — everything above was checked against the documented
  Harness NextGen YAML schema and this repo's actual file paths/service
  names/branch, not against a live pipeline run. `README.md` gained a short
  "CI/CD (Harness)" subsection pointing at `.harness/README.md`.

## Current Phase

### Phase 3 — Pagination

Not started. See `PLAN.md` for the upstream pagination semantics, the
`getWithMeta()` refactor, and the four call sites (DTOs, interceptor,
nested routes, Swagger) it touches. No longer a prerequisite for any
other phase — pagination was always independent feature work, not a
platform prerequisite. Phase 8 (Observability) is next up otherwise, once
a real Harness account exists to finish wiring Phase 7's connectors and
Delegate.

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
