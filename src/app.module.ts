import { Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from './config/config.types';
import configuration from './config/configuration';
import { Environment, validate } from './config/env.validation';
import { UpstreamModule } from './upstream/upstream.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { PostsModule } from './modules/posts/posts.module';
import { UsersModule } from './modules/users/users.module';
import { CommentsModule } from './modules/comments/comments.module';
import { TodosModule } from './modules/todos/todos.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { PhotosModule } from './modules/photos/photos.module';
import { HealthModule } from './health/health.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpCacheInterceptor } from './common/interceptors/http-cache.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

// `pino-pretty` is a devDependency, deliberately stripped from the
// production Docker image by `npm prune --omit=dev` (Dockerfile) — so
// whether it's available depends on how the process was started, not on
// NODE_ENV. Gating the transport on NODE_ENV instead is a real trap: the
// k3d overlays/local ConfigMap sets NODE_ENV=development on that same
// pruned production image (just to get the debug log level below), and
// pino's transport loader throws synchronously if the target module can't
// be resolved — crashing the whole app on boot rather than merely logging
// less prettily.
function isPinoPrettyAvailable(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    // Registered as early as possible so every other module's Logger calls
    // (including ones made during their own construction) already route
    // through pino. `app.useLogger()` in main.ts is what actually swaps
    // Nest's default Logger over at runtime; this just makes the instance
    // available to inject and to `useLogger` with.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const isProduction =
          configService.get('env', { infer: true }) === Environment.Production;
        return {
          pinoHttp: {
            // Tests boot the full AppModule (test/support/create-test-app.ts)
            // but never call useLogger(), and don't want JSON log spam
            // either way.
            level:
              configService.get('env', { infer: true }) === Environment.Test
                ? 'silent'
                : isProduction
                  ? 'info'
                  : 'debug',
            // Pretty output when pino-pretty is actually installed (local
            // `npm run start`/`start:dev`, which run from source with every
            // devDependency present); structured JSON everywhere it isn't
            // (Docker, k3d, docker-compose), regardless of NODE_ENV — see
            // isPinoPrettyAvailable()'s comment. `exactOptionalPropertyTypes`
            // forbids `transport: undefined` explicitly, hence the
            // conditional spread rather than a ternary (see
            // UpstreamService.toAxiosOptions() for the same pattern).
            ...(isPinoPrettyAvailable() && {
              transport: { target: 'pino-pretty' },
            }),
            // trace_id/span_id correlation is added automatically by
            // @opentelemetry/instrumentation-pino (see instrumentation.ts)
            // whenever a span is active — no manual mixin needed here.
            //
            // This one access-log line per request (method, url, status,
            // duration) is now the only per-request log line for anything
            // that isn't a 5xx — there used to be a second, near-identical
            // one from a hand-rolled LoggingInterceptor. That interceptor
            // couldn't cover requests that never reach a matched route
            // (an unknown path, a body Fastify itself rejects) anyway,
            // since interceptors only run once a route has matched; this
            // hook-based logger, registered for every request the same way
            // as registerCorrelationIdHook, does. AllExceptionsFilter still
            // logs 5xx responses separately, with the stack trace this
            // access log doesn't carry.
            customLogLevel: (_req, res, err) =>
              err || res.statusCode >= 500
                ? 'error'
                : res.statusCode >= 400
                  ? 'warn'
                  : 'info',
            // registerCorrelationIdHook stashes the id on the raw
            // IncomingMessage as well as on the FastifyRequest wrapper,
            // specifically so this can read it back — keeping this access
            // log line tied to the same id as the response envelope and
            // every other log line for the request.
            customProps: (req) => ({ correlationId: req.correlationId }),
          },
        };
      },
    }),
    MetricsModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        ttl: configService.get('cache.ttlMs', { infer: true }),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => [
        {
          ttl: configService.get('throttle.ttlMs', { infer: true }),
          limit: configService.get('throttle.limit', { infer: true }),
        },
      ],
    }),
    UpstreamModule,
    PostsModule,
    UsersModule,
    CommentsModule,
    TodosModule,
    AlbumsModule,
    PhotosModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    // Every request schema is a zod DTO now, so this is the only pipe left:
    // it validates and transforms @Body()/@Query() arguments against their
    // zod schema, and fails closed (500) if one has no zod DTO — see its
    // own doc comment for why.
    {
      provide: APP_PIPE,
      useValue: new ZodValidationPipe({ failClosed: true }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Bound outermost to innermost: Transform must see the raw handler
    // result before it's enveloped, whether that result came from the
    // handler or the cache, so every response — cache hits included — gets
    // a fresh timestamp and correlation id; Cache sits next so a hit
    // short-circuits everything inside it (Timeout, the real handler, the
    // upstream call); Timeout sits closest to the handler so it only ever
    // races real work.
    //
    // `request.correlationId`, which Transform/AllExceptionsFilter both
    // read, is set upstream of all of this by a Fastify `onRequest` hook
    // (see registerCorrelationIdHook) rather than by an interceptor —
    // interceptors only run once a route has matched, which would leave
    // unmatched-route 404s without a correlation id. Per-request access
    // logging (method, url, status, duration) is pino-http's job, not an
    // interceptor's, for the same reason — see the pinoHttp config above.
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
})
export class AppModule implements OnApplicationShutdown {
  private readonly logger = new Logger(AppModule.name);

  onApplicationShutdown(signal?: string): void {
    this.logger.log(`Shutting down (signal: ${signal ?? 'unknown'})`);
  }
}
