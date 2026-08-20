import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfig } from '../config/config.types';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TerminusModule,
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        timeout: configService.get('http.timeoutMs', { infer: true }),
      }),
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
