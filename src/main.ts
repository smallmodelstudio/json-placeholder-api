import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/config.types';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService: ConfigService<AppConfig, true> = app.get(ConfigService);

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
    .addTag('health', 'Liveness/readiness — pings the upstream')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(configService.get('port', { infer: true }));
}
void bootstrap();
