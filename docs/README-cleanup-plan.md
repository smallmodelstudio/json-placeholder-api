# Cleanup plan

A full-repo audit (behaviour, good NestJS practice, architecture) turned up
a set of bugs and gaps to close before the next round of feature work
(persistence, CQRS — tracked separately, not here). Six groups, one branch
per group, docs and tests updated alongside each.

See [Cleanup progress](README-cleanup-progress.md) for what's actually
landed so far.

## Group 1 — Runtime bugs

1. OTel SDK shutdown crash on SIGTERM when the collector is unreachable
   (`instrumentation.ts`).
2. Rate limiting shares one bucket across every client behind a reverse
   proxy — no `trustProxy` on the Fastify adapter.
3. `/health/ready`'s 503 breaks the error envelope (non-string
   message/error leak Terminus's raw `HealthCheckResult`).
4. PUT accepts a partial body on all six resources because it reuses the
   PATCH (`PartialType`) DTO.
5. `UpstreamService` retries POST/PATCH on 5xx/timeout, risking duplicate
   writes.
6. `ParsePositiveIntPipe` accepts `0x1`, `1e3`, etc. via a bare `Number()`.

## Group 2 — Bootstrap & logging consolidation

- Shared `configureApp()` for `main.ts` / `test/support/create-test-app.ts`,
  so the two don't have to be kept in sync by hand.
- Reconcile pino-http's own request log with `LoggingInterceptor` — a
  failed request currently logs three overlapping lines.

## Group 3 — Config, correlation ids, error messages, Swagger

- Single source of env defaults (today split between `env.validation.ts`
  and `configuration.ts`); type `AppConfig.env` as the actual `Environment`
  union instead of `string`.
- Validate/bound an incoming `x-correlation-id` instead of echoing anything
  a client sends verbatim.
- Stop leaking upstream method/path detail into client-facing error
  messages (e.g. `"Upstream responded with 404: GET /posts/999"`).
- Document error responses in Swagger; fix `correlationId`'s documented
  format (not always a UUID); add the missing `QueryUsersDto`.

## Group 4 — CI/CD and k8s

- Split lint (check-only, blocking) from the auto-fixing `npm run lint` so
  CI can actually fail on a formatting problem.
- Fix the image-tag flow so prod deploys what CI tested (today CI pushes to
  a placeholder registry the k3d overlay never reads from, and the prod tag
  is never promoted).
- Resolve the HPA vs. Deployment replica-count conflict; add a
  `securityContext` and `preStop` hook; fix the PDB for single-replica
  overlays.
- `OTEL_SERVICE_NAME`'s version falls back to `0.0.0` outside `npm run`
  (Docker, k8s) since `npm_package_version` isn't set there.

## Group 5 — Housekeeping

- Drop unused dependencies (`ts-loader`, `source-map-support`,
  `@eslint/eslintrc`, `@opentelemetry/instrumentation-http`,
  `@opentelemetry/instrumentation-nestjs-core` — the last two are already
  bundled by `getNodeAutoInstrumentations()`).
- Fix stale comments found during the audit (e.g. `enableShutdownHooks`'s
  described location, the ConfigMap/OTel comment in `.env.example`).
- Tighten the three relaxed lint rules back to `error` now that the repo
  runs at zero warnings.
- Add missing test coverage: cache/throttle env validation, coverage
  thresholds in `vitest.config.mts`.

## Group 6 — Dependency upgrade

- `npm audit fix` for the `fast-uri` advisory (no breaking change).
- Nest 12 / Fastify major-version bump to close the remaining `fastify`
  advisories (`@nestjs/platform-fastify` only fixes them at 12.x).
