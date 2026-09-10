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

## Current Phase

### Phase 2 — TypeScript 6 as compiler, TypeScript 7 (`tsgo`) as type-checker

Not started. See `PLAN.md` for the constraint driving the ordering (`ts-jest`
was the blocker; it's gone) and the specific tsconfig hardening planned.

## Active Context Architecture

- Vitest globals are deliberately **off** — every spec imports its own
  `describe`/`it`/`vi`/etc.; see `test/README.md` for the pattern per kind.
- `unplugin-swc` reads decorator settings from `tsconfig.json` automatically
  — don't duplicate that config in `vitest.config.mts`.
