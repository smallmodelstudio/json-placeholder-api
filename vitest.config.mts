import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// unplugin-swc reads experimentalDecorators/emitDecoratorMetadata straight
// out of tsconfig.json, which is what makes Nest's DI metadata (constructor
// injection, `@Injectable`, etc.) survive esbuild-less compilation — vitest's
// default esbuild transform does not implement emitDecoratorMetadata at all.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
      // Below the current baseline (see README-testing.md), so a drop
      // fails test:cov without chasing 100% on files that are exercised
      // by e2e/boot rather than unit tests (app.module.ts, bootstrap.ts,
      // instrumentation.ts, the *.module.ts files).
      thresholds: {
        statements: 90,
        branches: 75,
        functions: 90,
        lines: 90,
      },
    },
    // Three projects instead of three jest config files. Run one with
    // `--project <name>`, or omit the flag to run all of them. See
    // docs/README-testing.md for what belongs in each.
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.e2e.spec.ts'],
          setupFiles: ['./test/support/nock-setup.ts'],
        },
      },
      {
        test: {
          name: 'contract',
          include: ['test/contract/**/*.contract.spec.ts'],
          testTimeout: 15_000,
        },
      },
    ],
  },
});
