# Testing

The three kinds of test, and how to add each.

## Projects

Each kind of test is its own Vitest project, defined in `vitest.config.mts`.

| Project | Location | Boots the app | Network | Run |
| --- | --- | --- | --- | --- |
| `unit` | `src/**/*.spec.ts`, next to the code | No | None; dependencies mocked | `npm test` |
| `e2e` | `test/e2e/*.e2e.spec.ts` | Yes | None; upstream mocked with nock | `npm run test:e2e` |
| `contract` | `test/contract/*.contract.spec.ts` | Yes | Real JSONPlaceholder | `npm run test:contract` |

`npm run test:all` runs all three. For watch mode on a single project, use
`npx vitest --project <name>`.

## How it works

- **Tests compile with SWC.** Vitest's default transform is esbuild, and esbuild
  doesn't emit decorator metadata. Nest's dependency injection depends on that
  metadata, so without it every injected constructor argument is `undefined`.
  `unplugin-swc` restores the metadata and reads its decorator settings from
  `tsconfig.json`.
- **Globals are off.** Every spec imports `describe`, `it`, `vi` and the rest from
  `'vitest'`.
- **Real network access is blocked in e2e tests.** `test/support/nock-setup.ts`
  allows only loopback traffic, so any upstream call without a mock fails.
- **Contract tests are opt-in.** Each contract spec skips itself unless
  `RUN_CONTRACT_TESTS=1` is set. Only `npm run test:contract` sets it, so
  `test:all` stays offline.
- **Coverage (`npm run test:cov`) covers the `unit` project only.** e2e tests run
  the same code over HTTP and would inflate the numbers. The report goes to
  `coverage/`.

## Adding a unit test

Put the spec next to its subject (`foo.service.ts` → `foo.service.spec.ts`).
Construct the class directly with mocked dependencies. Only use
`Test.createTestingModule` when the dependency wiring is itself what you're
testing.

```ts
import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';

describe('FooService', () => {
  let upstream: { get: Mock };
  let service: FooService;

  beforeEach(() => {
    upstream = { get: vi.fn() };
    service = new FooService(upstream as unknown as UpstreamService);
  });

  it('returns the upstream result', async () => {
    upstream.get.mockResolvedValueOnce({ id: 1 });
    await expect(service.findOne(1)).resolves.toEqual({ id: 1 });
  });
});
```

- Type bare mocks as `Mock`. Type spies from `vi.spyOn()` as `MockInstance`, and
  call `.mockRestore()` on them in `afterEach`.
- To silence a spy, use `.mockImplementation(() => {})`. Calling
  `.mockImplementation()` with no argument is a type error.

## Adding an e2e test

Create `test/e2e/<thing>.e2e.spec.ts`. The test boots the real `AppModule`, so the
full pipe, guard, interceptor and filter chain runs.

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

  it('returns the upstream list', async () => {
    mockUpstream().get('/foo').reply(200, [{ id: 1 }]);

    const response = await api(app).get('/foo').expect(200);

    const body = response.body as SuccessEnvelope<Foo[]>;
    expect(body.data).toEqual([{ id: 1 }]);
  });
});
```

Helpers in `test/support/`:

| Helper | Use |
| --- | --- |
| `api(app)` | Supertest bound to the app. Use this instead of `request(app.getHttpServer())`, which is typed `any` and triggers a lint warning |
| `createTestApp(options?)` | Boots `AppModule` on Fastify. `{ configure: (b) => b.overrideProvider(…) }` swaps a provider |
| `mockUpstream()` | A nock scope bound to `UPSTREAM_BASE_URL` |
| `withEnvOverrides(env, fn)` | Sets env vars while `fn` runs. Create the app inside `fn` so it picks them up (see `throttle.e2e.spec.ts`) |
| `SuccessEnvelope<T>`, `ErrorEnvelope` | Types for `response.body` |

To change a config value such as a timeout or a limit, use `withEnvOverrides`
rather than `overrideProvider`: config is re-read from `process.env` every time a
test app is created.

## Adding a contract test

Create `test/contract/<thing>.contract.spec.ts`. Wrap the suite in the file's
`describeIfEnabled` gate, and don't use nock or provider overrides. Assert on
shape (`expect.any(Number)`), not exact values, because upstream data can change.
Contract tests catch upstream drift that hand-written nock fixtures can't.
