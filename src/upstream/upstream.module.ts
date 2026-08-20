import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/config.types';
import { UpstreamService } from './upstream.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        baseURL: configService.get('http.baseUrl', { infer: true }),
        timeout: configService.get('http.timeoutMs', { infer: true }),
      }),
    }),
  ],
  providers: [UpstreamService],
  exports: [UpstreamService],
})
export class UpstreamModule {}
