import { INestApplication } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

export interface CreateTestAppOptions {
  /**
   * Escape hatch for tests that need to swap a provider out entirely (e.g.
   * mocking `UpstreamService` directly instead of going through nock).
   * For config values, prefer `withEnvOverrides` (see with-env-overrides.ts)
   * — `AppModule`'s `ConfigModule.forRoot({ load: [configuration] })` reads
   * `process.env` fresh on every `compile()`, so an env override is usually
   * simpler than reaching for this.
   */
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export async function createTestApp(
  options: CreateTestAppOptions = {},
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.configure) {
    builder = options.configure(builder);
  }

  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}
