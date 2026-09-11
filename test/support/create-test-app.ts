import { INestApplication } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp, createFastifyAdapter } from '../../src/bootstrap';

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

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    // createFastifyAdapter() mirrors main.ts, so a test can exercise the
    // TRUST_PROXY behaviour via withEnvOverrides (see throttle.e2e.spec.ts).
    createFastifyAdapter(),
  );
  configureApp(app);
  await app.init();
  // Fastify's underlying server isn't routable until it has finished its own
  // async boot — supertest hitting getHttpServer() before this resolves
  // sees connection resets.
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
