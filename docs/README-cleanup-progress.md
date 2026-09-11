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
   *before* a route's own pipe runs — confirmed by instrumenting the pipe
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

## Groups 2–6 — not started

See the plan for scope.
