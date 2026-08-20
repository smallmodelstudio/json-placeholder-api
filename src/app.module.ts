import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { UpstreamModule } from './upstream/upstream.module';
import { PostsModule } from './modules/posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    UpstreamModule,
    PostsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
