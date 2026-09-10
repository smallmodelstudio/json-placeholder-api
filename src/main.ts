import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/config.types';
import { registerCorrelationIdHook } from './common/hooks/correlation-id.hook';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const configService: ConfigService<AppConfig, true> = app.get(ConfigService);

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
  // its container once it's deployed in one (Phase 5).
  await app.listen({
    port: configService.get('port', { infer: true }),
    host: '0.0.0.0',
  });
}
void bootstrap();
