# Cleanup progress

Status of the plan in [Cleanup plan](README-cleanup-plan.md). Updated as
each group lands; delete this file (and the plan) once group 6 ships and
CLAUDE.md's docs-describe-current-state norm applies again.

## Group 1 — Runtime bugs — done (branch `cleanup/runtime-bugs`)

1. **OTel shutdown crash on SIGTERM.** Extracted `registerShutdownHandler`
   (`src/common/utils/`, with its own spec) so `sdk.shutdown()`'s rejection
   is logged instead of crashing the process. Verified against the
   compiled build: exit code 1 → 0 with an unreachable collector.
2. **trustProxy / shared throttle bucket.** Added `TRUST_PROXY` (read
   directly via `process.env`, same pattern as `OTEL_*`), off by default,
   on in `k8s/base/configmap.yaml`. New e2e tests in
   `throttle.e2e.spec.ts` cover both the off (shared bucket) and on
   (per-client bucket) cases.
3. **`/health/ready` error envelope.** `AllExceptionsFilter` now falls back
   to the exception's own message/`STATUS_CODES` text for any
   `HttpException` body that isn't `{message, error}`-shaped (covers
   Terminus, and any future case, not just this one).
   `HealthController` also catches its own `ServiceUnavailableException`
   and rethrows with a specific `"Health check failed: <checks>"` message.
   Added `errorEnvelopeSchema` for the corrected Swagger doc.
4. **PUT accepts a partial body.** All six controllers/services now take
   the full `Create*Dto` for PUT (`update`), keeping `Update*Dto`
   (`PartialType`) for PATCH only. Added a "rejects a partial body" e2e
   test per resource.
5. **Non-idempotent retries.** `UpstreamService.isRetryable` now also
   checks the HTTP method is idempotent (GET/HEAD/OPTIONS/PUT/DELETE)
   before ever considering a retry — POST/PATCH fail on the first attempt.
6. **`ParsePositiveIntPipe` accepts `0x1`/`1e3`.** Turned out to be a
   two-part bug: Nest's global `ValidationPipe` (`transform: true`) already
   coerces any Number-typed `@Param()`/`@Query()` via a lossy `+value`
   _before_ a route's own pipe runs — confirmed by instrumenting the pipe
   directly, which showed it receiving the already-coerced JS number, not
   the original string. Fixing `ParsePositiveIntPipe` alone wasn't enough.
   Added a second pipe, `StrictNumberFormatPipe`, registered globally
   ahead of `ValidationPipe`, that rejects non-plain-integer strings before
   that coercion happens. Verified against the compiled build: `GET
/posts/0x1` and `/posts/1e2` now 400 (were 502, having silently
   resolved to `/posts/1` upstream).

**Verification:** lint (0 issues), typecheck, build, `prettier --check`,
and `vitest run` (unit + e2e + contract) all clean — 311 tests passed, 3
contract tests skipped as designed (no `RUN_CONTRACT_TESTS`).

**Docs touched:** `README-getting-started.md` (`TRUST_PROXY`),
`README-architecture.md` (rate-limiting note, non-idempotent-retries note).

## Group 2 — Bootstrap & logging consolidation — done (branch `cleanup/runtime-bugs`)

1. **Shared `configureApp()`.** Added `src/bootstrap.ts`, exporting
   `createFastifyAdapter()` (the `TRUST_PROXY` adapter options) and
   `configureApp()` (registers `registerCorrelationIdHook`). Both `main.ts`
   and `test/support/create-test-app.ts` now call into it instead of each
   carrying its own copy of the adapter options and hook registration.
2. **Three overlapping log lines on a failed request.** Removed
   `LoggingInterceptor` — it duplicated pino-http's own per-request access
   log, and unlike pino-http it never fired for an unmatched-route 404
   (interceptors only run once a route matches). pino-http's `pinoHttp`
   config in `app.module.ts` now carries `customLogLevel` (info/warn/error
   by status code, matching what the interceptor used to do) and
   `customProps` (tags each access-log line with the request's
   `correlationId`, read off the raw `IncomingMessage` — see the
   `registerCorrelationIdHook` and `fastify.d.ts` comments for why it's
   stashed there too, not just on the `FastifyRequest` wrapper). A failed
   5xx request now logs two lines (pino-http's access log, and
   `AllExceptionsFilter`'s error log with the stack trace) instead of three;
   everything else logs one instead of two.

**Verification:** lint (0 issues), typecheck, build, `prettier --check`, and
`vitest run` all clean — 309 tests passed, 3 contract tests skipped as
designed. Also checked by hand against `npm run start` and the compiled
`dist/src/main.js`: a 200, a 400, an unmatched-route 404, and a synthetic
502 (`UPSTREAM_BASE_URL` pointed at a closed port) each produce the log
lines described above, with the `correlationId` in the access log line
matching the one in the response envelope.

**Docs touched:** `README-architecture.md` (layout, request lifecycle,
interceptor-ordering note, correlation-id gotcha).

## Group 3 — Config, correlation ids, error messages, Swagger — done (branch `cleanup/config-correlation-swagger`)

1. **Split env defaults.** `configuration.ts` used to re-parse `process.env`
   with its own copy of every default (`'3000'`, `'development'`, …),
   separate from `env.validation.ts`'s. It now calls `validate(process.env)`
   itself and just reshapes the result into `AppConfig`'s nesting — one place
   (`env.validation.ts`) owns every default and every parse. `AppConfig.env`
   is now the actual `Environment` union (exported from `env.validation.ts`)
   instead of `string`; `app.module.ts`'s two `configService.get('env', ...)`
   comparisons now compare against `Environment.Production`/`Environment.Test`
   rather than string literals (required once the type stopped being `string`
   — `@typescript-eslint/no-unsafe-enum-comparison` caught it immediately).
2. **Unvalidated `x-correlation-id`.** A client-supplied header used to be
   echoed back verbatim into the response header, every log line for the
   request, and the response envelope. `correlation-id.hook.ts` now only
   reuses it if it's 1–128 characters of `[A-Za-z0-9_-]`
   (`isValidCorrelationId`); anything else — oversized, or containing
   whitespace/control characters that could break a log line — falls back to
   a generated id, same as a missing header.
3. **Upstream method/path leak.** `AllExceptionsFilter.resolveUpstreamException`
   used to pass a 4xx's `exception.message` straight to the client — built by
   `UpstreamService.mapError` as `"Upstream responded with 404: GET
   /posts/999"`, i.e. internal request detail with no business reaching a
   caller. It now sends a generic, status-derived message (`STATUS_CODES[status]`,
   the same text Nest's own exceptions default to), matching `error`.
4. **Swagger.** `metaSchema.correlationId` claimed `format: 'uuid'`; it's
   sometimes a client-supplied string or a 32-hex-char trace id, so the
   format claim is gone. Added `ApiCommonErrorResponses()`
   (400/404/429/502/504, `errorEnvelopeSchema`) as a class decorator on all
   six resource controllers — previously only `HealthController`'s 503 was
   documented. Added `QueryUsersDto` (`username`, `email`) — `GET /users` was
   the one list endpoint with no query DTO at all, so unlike every other
   resource's `?xId=` filter, an unknown `/users` query param was silently
   ignored instead of the usual 400.

**Verification:** lint (0 issues), typecheck, build, `prettier --check`, and
`vitest run` (unit + e2e + contract) all clean — 324 tests passed, 3 contract
tests skipped as designed. Also checked by hand against the compiled build:
an invalid `x-correlation-id` header is replaced rather than echoed, a
upstream 404's `message` is `"Not Found"` with no method/path in it, `GET
/users?username=` and `?email=` forward as upstream params (and an invalid
`?email=` 400s), and `/docs-json` lists 400/404/429/502/504 for every
resource route.

**Docs touched:** `README-architecture.md` (request lifecycle,
correlation-id gotcha, cross-cutting-concerns API-docs row).

## Group 4 — CI/CD and k8s — done (branch `cleanup/ci-cd-k8s`)

1. **Auto-fixing lint in CI.** `npm run lint` runs ESLint with `--fix`, so a
   formatting problem gets silently rewritten and the job still exits 0.
   Added `lint:check` (same rules, no `--fix`) and pointed `ci.yaml`'s Lint
   step at it; `lint` stays as the local, auto-fixing command.
2. **Image-tag flow.** Two separate bugs, one fix. `ci.yaml`'s promote step
   used to touch only `k8s/overlays/local`, and pointed it at
   `k3d-jsonplaceholder-registry:5000` — a hostname that only resolves
   inside a local k3d cluster's own docker network, not from wherever this
   pipeline actually runs, and not what `Build and push image` had just
   pushed to (`REPLACE_WITH_REAL_REGISTRY`). The local overlay's manifest
   was therefore never pullable by anything Harness itself deployed.
   Separately, `k8s/overlays/prod`'s image was never touched by CI at all,
   so `cd.yaml`'s prod stage — even after approval — would apply whatever
   `REPLACE_WITH_REAL_TAG` happened to be committed, not the build that was
   actually tested. Renamed the step to "Promote image tag to overlays"; it
   now loops over both overlays, setting each to
   `REPLACE_WITH_REAL_REGISTRY/json-placeholder-api:<shortCommitSha>` — the
   exact image `Build and push image` just pushed — in one commit. The
   manual-approval gate in `cd.yaml` is now the only thing between a change
   and prod, not a stale manifest.
3. **HPA vs. Deployment replica-count conflict.** `deployment.yaml` set
   `spec.replicas: 2`, and both overlays additionally set it via Kustomize's
   `replicas:` generator (local: 1, prod: 3) — any of these gets re-applied
   on every deploy, resetting the HPA's scaling back to that static number.
   Removed `replicas:` from the base Deployment and both overlays entirely;
   omitting it lets Kubernetes default to 1 replica on first create only,
   with the HPA (already patched per overlay) reconciling up to its
   `minReplicas` from there without a later deploy ever fighting it.
4. **`securityContext` and `preStop`.** Added a hardened pod/container
   `securityContext` (non-root, no privilege escalation, read-only root
   filesystem, all capabilities dropped — confirmed nothing in `src/` writes
   to disk) and a `preStop` hook (`sleep 5`) so a pod clears the Service's
   endpoints before SIGTERM actually stops traffic from arriving, both to
   `deployment.yaml`.
5. **PDB blocks single-replica drains.** `pdb.yaml` used `minAvailable: 1`,
   which for the 1-replica local overlay equals the total replica count —
   `disruptionsAllowed` is permanently 0, so a voluntary disruption (e.g.
   `kubectl drain`) blocks forever. Switched to `maxUnavailable: 1`, which
   gives the same "at most one pod down" guarantee for the multi-replica
   overlays while still permitting that one pod to be evicted when it's the
   only one.
6. **`OTEL_SERVICE_NAME`'s version defaults to `0.0.0`.** `npm_package_version`
   is only set by `npm run *`; it's absent from the Dockerfile/k8s
   invocation (`node --import ./dist/src/instrumentation.js dist/src/main.js`).
   `instrumentation.ts` now reads `package.json`'s `version` directly via
   `readFileSync(join(__dirname, '../../package.json'))`, resolved relative
   to the module's own compiled location rather than `process.cwd()` — works
   identically under `npm run`, the compiled Docker image, and k8s.
   Verified against the compiled build with an empty environment (`env -i`)
   and from an unrelated working directory: resolves to the real
   `package.json` version (`0.0.1`) in both cases, not the `0.0.0` fallback.

**Verification:** lint (0 issues), lint:check (0 issues), typecheck, build,
`prettier --check`, and `vitest run` all clean — 324 tests passed, 3
contract tests skipped as designed. `kustomize build` on both overlays
confirmed they still render (no `replicas:` field, correct
`securityContext`/`preStop`/PDB, HPA and image refs unaffected). The
Harness YAML itself is unverified against a real account, same as every
other pipeline file (see `README-harness.md`), so its two changes were
checked by rendering `kustomize edit set image` against a scratch copy of
both overlays and reading the resulting diff, not by running the pipeline.

**Docs touched:** `README-code-quality.md` (`lint`/`lint:check` split),
`README-harness.md` (image-promotion flow, now covers both overlays),
`README-docker-k8s.md` (Deployment/PDB table rows, prod overlay's
placeholder status, a new gotcha on the local overlay's image drifting
between the manual loop and Harness-promoted values).

## Group 5 — Housekeeping — done (branch `cleanup/housekeeping`)

1. **Unused dependencies.** Dropped `ts-loader` (no webpack build —
   `nest-cli.json` has no `builder` override), `source-map-support` (never
   imported), `@eslint/eslintrc` (never imported; `eslint.config.mjs` is
   flat-config only), and `@opentelemetry/instrumentation-http` /
   `@opentelemetry/instrumentation-nestjs-core` (never imported directly —
   both are already pulled in transitively by
   `getNodeAutoInstrumentations()`, so removing the explicit dependency
   changes nothing at runtime). `npm uninstall` regenerated
   `package-lock.json`; build/lint/typecheck/tests all still pass.
2. **Stale comments.** `instrumentation.ts`'s shutdown-hook comment said
   `app.enableShutdownHooks()` lived in `app.module.ts`; it's actually
   called in `main.ts`. `.env.example`'s `OTEL_EXPORTER_OTLP_ENDPOINT`
   comment said `k8s/base/configmap.yaml` points it at the in-cluster
   collector; the base ConfigMap actually keeps the `localhost:4318`
   default — it's `k8s/overlays/local`'s Kustomize patch that redirects it
   to the `otel-lgtm` Service, and `overlays/prod` has no backend at all.
3. **Lint rules.** `eslint.config.mjs` set `no-explicit-any` to `off` and
   `no-floating-promises`/`no-unsafe-argument` to `warn` — all three are
   `error` in `typescript-eslint`'s `recommendedTypeChecked` already, so
   the overrides just relaxed the default. Deleted the override block
   entirely (confirmed `lint:check` still reports zero issues at the
   default severity) rather than spelling out `'error'` redundantly.
4. **Missing test coverage.** `env.validation.spec.ts` covered `NODE_ENV`,
   `PORT` and `UPSTREAM_BASE_URL` but never touched `CACHE_TTL_MS`,
   `THROTTLE_TTL_MS` or `THROTTLE_LIMIT`; added cases for a valid zero
   `CACHE_TTL_MS` and rejection of a negative `CACHE_TTL_MS` and a
   sub-1 `THROTTLE_TTL_MS`/`THROTTLE_LIMIT`. `vitest.config.mts` had no
   coverage thresholds, so a regression could ship silently; added a
   global statements/branches/functions/lines floor (90/75/90/90) set just
   below the current baseline (92.2/78.83/91.97/92.8) — verified it both
   passes as configured and actually fails `test:cov` when a threshold is
   pushed above the baseline.

**Verification:** lint (0 issues), lint:check (0 issues), typecheck, build,
`prettier --check`, and `vitest run` all clean — 328 tests passed, 3
contract tests skipped as designed. `test:cov` passes its new thresholds.

**Docs touched:** `README-code-quality.md` (removed the now-nonexistent
lint rule overrides section), `README-testing.md` (coverage thresholds).

## Group 6 — not started

See the plan for scope.
