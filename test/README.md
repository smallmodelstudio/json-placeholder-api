# Tests

Three kinds of test, each its own Vitest **project** (`vitest.config.mts`), each with
a different job and a different cost:

| Project | Lives in | Boots the app? | Network | Run with |
| --- | --- | --- | --- | --- |
| `unit` | `src/**/*.spec.ts` (colocated) | No | None (deps mocked) | `npm test` |
| `e2e` | `test/e2e/**/*.e2e.spec.ts` | Yes | None (nock-mocked upstream) | `npm run test:e2e` |
| `contract` | `test/contract/**/*.contract.spec.ts` | Yes | Real — hits JSONPlaceholder | `npm run test:contract` (opt-in) |

`npm run test:all` runs all three in one process. `npm run test:cov` runs `unit` with
a coverage report. Any command also accepts `--project <name>` if you want to run just
one ad hoc, e.g. `npx vitest --project unit` for watch mode on a single project.

Vitest globals (`describe`, `it`, `vi`, …) are **not** enabled — every spec imports
what it uses from `'vitest'` explicitly. This keeps ESLint's unused-import check
honest and makes each file's dependencies visible at a glance; copy that import line
from a neighbouring spec rather than guessing.

## Adding a unit test

Unit tests mock every dependency and never touch a real Nest application — they're
the fast, exhaustive layer. Put the spec next to the file it tests
(`foo.service.ts` → `foo.service.spec.ts`), and construct the class under test
directly rather than through `Test.createTestingModule` where you can — that's
simpler and just as fast. `Test.createTestingModule` is worth it for
controllers/services with multiple constructor deps, or where DI wiring itself is
part of what you're testing (see `upstream.service.spec.ts`).

Mocking pattern (see any `*.service.spec.ts` for the full version):

```ts
import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';

describe('FooService', () => {
  let upstream: { get: Mock; post: Mock };

  beforeEach(() => {
    upstream = { get: vi.fn(), post: vi.fn() };
    // ... construct FooService(upstream as unknown as UpstreamService)
  });

  it('does the thing', async () => {
    upstream.get.mockResolvedValueOnce({ id: 1 });
    // ...
  });
});
```

- `vi.fn()` for a bare mock function; type the holder as `Mock` (from `'vitest'`).
- `vi.spyOn(Target.prototype, 'method')` to spy on/stub a real method (see
  `logging.interceptor.spec.ts` for spying on `Logger`); type the holder as
  `MockInstance`. Always `.mockRestore()` it in `afterEach`.
- `vi.spyOn(...).mockImplementation(...)` needs an explicit function argument in
  Vitest — `.mockImplementation()` with no args is a type error, unlike Jest. Use
  `.mockImplementation(() => {})` for a silencing no-op.

## Adding an e2e test

e2e tests boot the real `AppModule` (so the full interceptor/filter/guard chain
runs) and stub the upstream HTTP call with `nock` — no real network. Put the spec in
`test/e2e/`, named `<thing>.e2e.spec.ts`.

```ts
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { api } from '../support/api';
import { createTestApp } from '../support/create-test-app';
import { mockUpstream } from '../support/upstream-mock';
import { SuccessEnvelope } from '../support/response-envelope';

describe('Foo (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the list from upstream', async () => {
    mockUpstream().get('/foo').reply(200, [{ id: 1 }]);

    const response = await api(app).get('/foo').expect(200);

    const body = response.body as SuccessEnvelope<Foo[]>;
    expect(body.data).toEqual([{ id: 1 }]);
  });
});
```

`test/support/` helpers:

- **`api(app)`** — supertest bound to the booted app: `api(app).get('/foo')`.
  Always go through this rather than `request(app.getHttpServer())` — Nest types
  `getHttpServer()` as `any`, so the raw form trips
  `@typescript-eslint/no-unsafe-argument` at every call site; `api()` holds the
  single `as Server` assertion that keeps the specs clean.
- **`createTestApp(options?)`** — boots `AppModule`. Pass `{ configure: (builder) =>
  builder.overrideProvider(...) }` if a test needs to swap a provider out entirely.
  For config *values* (timeouts, throttle limits), prefer `withEnvOverrides` below —
  `ConfigModule.forRoot({ load: [configuration] })` re-reads `process.env` on every
  fresh `compile()`, so it's usually the simpler seam.
- **`mockUpstream()`** — a `nock` scope pre-bound to `UPSTREAM_BASE_URL`.
- **`withEnvOverrides(overrides, fn)`** — temporarily sets env vars for the duration
  of `fn`, restoring them after. Use this when a test needs a different timeout,
  retry count, cache TTL, or throttle limit than the defaults; create the app
  *inside* the callback so it picks up the override (see `throttle.e2e.spec.ts`).
- **`response-envelope.ts`** — `SuccessEnvelope<T>`/`ErrorEnvelope` types for typing
  `response.body`.

`nock.disableNetConnect()` is on globally for this project (`nock-setup.ts`, wired
via `setupFiles`) with `127.0.0.1` allowed through for supertest's own loopback
calls — an unmocked upstream call fails loudly instead of hitting the real network.

## Adding a contract test

Contract tests hit the real `jsonplaceholder.typicode.com` through the real app —
no nock, no `AppModule` overrides. They exist to catch upstream drift that
hand-written nock fixtures (which only ever assert what we already believe is true)
never could. Put the spec in `test/contract/`, named `<thing>.contract.spec.ts`, and
assert on shape (`expect.any(Number)`, `expect.any(String)`) rather than exact
values, since the fixture data can change upstream.

They're gated by `RUN_CONTRACT_TESTS=1`, checked inside the spec file itself
(`describeIfEnabled`) — not by the project split, since `test:all` runs this project
too. Without the flag, the whole file is skipped rather than reaching out to the
real network; only `npm run test:contract` sets it.

## Coverage

`npm run test:cov` runs the `unit` project under `@vitest/coverage-v8` and writes
`coverage/` (gitignored). Coverage is intentionally scoped to `unit` — e2e/contract
tests exercise the same code paths through HTTP and would just inflate the numbers
without adding a distinct signal about the code itself.
