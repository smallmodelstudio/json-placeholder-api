import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/config.types';
import { registerCorrelationIdHook } from './common/hooks/correlation-id.hook';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Trust exactly the reverse proxy directly in front of this app
      // (Traefik, in every k8s overlay) so ThrottlerGuard's per-IP buckets
      // (which key on request.ip) see the real client IP from
      // X-Forwarded-For, not the proxy's own address — otherwise every
      // client behind the same proxy shares one bucket. Read directly from
      // process.env, the same as instrumentation.ts's OTEL_* variables:
      // ConfigService doesn't exist yet at this point in bootstrap. Off by
      // default — docker-compose and `npm run start*` expose the app
      // directly, with no proxy in front, and trusting a client-supplied
      // X-Forwarded-For there would let a client spoof its own rate-limit
      // identity.
      trustProxy: process.env['TRUST_PROXY'] === 'true',
    }),
    { bufferLogs: true },
  );
  const configService: ConfigService<AppConfig, true> = app.get(ConfigService);

  // Swaps Nest's default console Logger for pino app-wide — every
  // `new Logger(...)` call throughout the app (UpstreamService,
  // AllExceptionsFilter, etc.) routes through this from here on, not just
  // calls made via DI injection. `bufferLogs: true` above holds Nest's own
  // bootstrap-time log lines until this runs, so they get pino-formatted
  // too instead of leaking out through the console logger first.
  app.useLogger(app.get(Logger));

  registerCorrelationIdHook(app.getHttpAdapter().getInstance());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('JSONPlaceholder Proxy API')
    .setDescription(
      'A NestJS proxy in front of jsonplaceholder.typicode.com, adding typed DTOs, validation, ' +
        'retries/timeouts, caching, rate limiting, and a consistent response/error envelope. ' +
        'Every success response is wrapped as { data, meta }; every error response as ' +
        '{ statusCode, message, error, path, timestamp, correlationId }.',
    )
    .setVersion('1.0')
    .addTag('posts', 'Blog posts, plus nested /posts/:id/comments')
    .addTag('users', 'Users, plus nested /users/:id/{posts,todos,albums}')
    .addTag('comments', 'Comments on posts')
    .addTag('todos', 'Todo items')
    .addTag('albums', 'Photo albums, plus nested /albums/:id/photos')
    .addTag('photos', 'Photos within an album')
    .addTag('health', 'Liveness (/health/live) and readiness (/health/ready)')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  // Bind 0.0.0.0 (not just localhost) so the app is reachable from outside
  // its container.
  await app.listen({
    port: configService.get('port', { infer: true }),
    host: '0.0.0.0',
  });
}
void bootstrap();
